import { supabase } from "./supabase.js";

/* ================= ROLE DETECTION ================= */
const params = new URLSearchParams(window.location.search);

// Doctor mode via secret URL
if (params.get("mode") === "doctor") {
  localStorage.setItem("role", "doctor");
}

const isDoctor = localStorage.getItem("role") === "doctor";

/* ================= ELEMENTS ================= */
const form = document.getElementById("appointmentForm");
const nameInput = document.getElementById("name");
const ageInput = document.getElementById("age");
const dateInput = document.getElementById("date");
const hiddenTime = document.getElementById("time");

const slotContainer = document.getElementById("slotContainer");
const morningSlots = document.getElementById("morningSlots");
const eveningSlots = document.getElementById("eveningSlots");

const dateHeaders = document.getElementById("dateHeaders");
const appointmentRows = document.getElementById("appointmentRows");

const modalOverlay = document.getElementById("modalOverlay");
const modalBtn = document.getElementById("modalBtn");

/* ================= HELPERS ================= */
function localDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function minsToTime(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function format12(time) {
  let [h, m] = time.split(":").map(Number);
  const p = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${p}`;
}

/* ================= DATE LIMIT ================= */
const today = new Date();
today.setHours(0, 0, 0, 0);

const maxDate = new Date(today);
maxDate.setDate(today.getDate() + 3);

dateInput.min = localDate(today);
dateInput.max = localDate(maxDate);

/* ================= SLOT CONFIG ================= */
const SLOT = 20;
const SESSIONS = [
  { name: "Morning", start: 600, end: 900 },   // 10:00–3:00
  { name: "Evening", start: 1080, end: 1320 }, // 6:00–10:00
];

/* ================= FETCH APPOINTMENTS ================= */
async function fetchAppointments() {
  const { data, error } = await supabase
    .from("appointments")
    .select("*");

  if (error) {
    console.error(error);
    return [];
  }
  return data;
}

/* ================= SLOT GENERATION ================= */
async function updateSlots(date) {
  morningSlots.innerHTML = "";
  eveningSlots.innerHTML = "";
  hiddenTime.value = "";

  if (!date) return;

  const selectedDate = new Date(date);

  // Saturday closed
  if (selectedDate.getDay() === 6) {
    slotContainer.classList.remove("hidden");
    morningSlots.innerHTML = `<p style="color:#999">Clinic Closed</p>`;
    eveningSlots.innerHTML = `<p style="color:#999">Clinic Closed</p>`;
    return;
  }

  const appointments = await fetchAppointments();
  const bookedTimes = appointments
    .filter(a => a.date === date)
    .map(a => a.time);

  SESSIONS.forEach(session => {
    const target =
      session.name === "Morning" ? morningSlots : eveningSlots;

    for (let t = session.start; t + SLOT <= session.end; t += SLOT) {
      const slotTime = minsToTime(t);
      const btn = document.createElement("button");

      btn.type = "button";
      btn.className = "slot-btn";
      btn.textContent = format12(slotTime);

      if (bookedTimes.includes(slotTime)) {
        btn.classList.add("slot-booked");
        btn.disabled = true;
      } else {
        btn.onclick = () => {
          document
            .querySelectorAll(".slot-btn")
            .forEach(b => b.classList.remove("slot-selected"));

          btn.classList.add("slot-selected");
          hiddenTime.value = slotTime;
        };
      }

      target.appendChild(btn);
    }
  });
}

/* ================= RENDER APPOINTMENTS ================= */
async function renderAppointments() {
  dateHeaders.innerHTML = "";
  appointmentRows.innerHTML = "";

  const appointments = await fetchAppointments();
  if (!appointments.length) return;

  const patientId = localStorage.getItem("patientAppointmentId");

  const grouped = {};
  appointments.forEach(a => {
    if (!grouped[a.date]) grouped[a.date] = [];
    grouped[a.date].push(a);
  });

  Object.keys(grouped)
    .sort((a, b) => new Date(a) - new Date(b))
    .forEach(date => {
      const th = document.createElement("th");
      th.textContent = new Date(date).toDateString();
      dateHeaders.appendChild(th);

      const td = document.createElement("td");

      grouped[date]
        .sort((a, b) => a.time.localeCompare(b.time))
        .forEach((a, i) => {

          // Patient: show ONLY their appointment
          if (!isDoctor && a.id !== patientId) return;

          const div = document.createElement("div");

          if (isDoctor) {
            div.innerHTML = `
              <strong>${i + 1}. ${a.name}</strong><br>
              Age: ${a.age}<br>
              <small>${format12(a.time)}</small>
            `;
          } else {
            div.innerHTML = `
              <strong>Your Serial Number: ${i + 1}</strong><br>
              <small>Time: ${format12(a.time)}</small>
            `;
          }

          td.appendChild(div);
        });

      appointmentRows.appendChild(td);
    });
}

/* ================= EVENTS ================= */
dateInput.addEventListener("change", () => {
  slotContainer.classList.remove("hidden");
  updateSlots(dateInput.value);
});

form.addEventListener("submit", async e => {
  e.preventDefault();

  if (!hiddenTime.value) {
    alert("Please select a time slot");
    return;
  }

  // 1️⃣ Insert appointment
  const { data, error } = await supabase
    .from("appointments")
    .insert({
      name: nameInput.value,
      age: ageInput.value,
      date: dateInput.value,
      time: hiddenTime.value,
    })
    .select()
    .single();

  if (error) {
    alert("Booking failed. Please try again.");
    return;
  }

  // Save patient appointment id
  localStorage.setItem("patientAppointmentId", data.id);

  // 2️⃣ Fetch all appointments of same date
  const { data: sameDayAppointments } = await supabase
    .from("appointments")
    .select("*")
    .eq("date", data.date)
    .order("time", { ascending: true });

  // 3️⃣ Calculate serial number
  const serialNumber =
    sameDayAppointments.findIndex(a => a.id === data.id) + 1;

  // 4️⃣ Show SUCCESS message with serial
  modalOverlay.querySelector("h3").textContent = "Appointment Confirmed";
  modalOverlay.querySelector("p").innerHTML = `
    <strong>Your booking is successful!</strong><br><br>
    <strong>Serial Number:</strong> ${serialNumber}<br>
    <strong>Time:</strong> ${format12(data.time)}<br><br>
    Please arrive 10 minutes early.
  `;

  modalOverlay.classList.remove("hidden");

  // Reset form
  form.reset();
  hiddenTime.value = "";
  slotContainer.classList.add("hidden");
  morningSlots.innerHTML = "";
  eveningSlots.innerHTML = "";

  renderAppointments();
});

modalBtn.addEventListener("click", () => {
  modalOverlay.classList.add("hidden");
});

/* ================= INIT ================= */
renderAppointments();
