import { supabase } from "./supabase.js";

/* ================= ROLE DETECTION ================= */
const params = new URLSearchParams(window.location.search);
if (params.get("mode") === "doctor") {
  localStorage.setItem("role", "doctor");
}
const role = localStorage.getItem("role") || "patient";

/* ================= PATIENT KEY ================= */
if (!localStorage.getItem("patientKey")) {
  localStorage.setItem(
    "patientKey",
    "patient_" + Date.now() + "_" + Math.random().toString(36).slice(2)
  );
}
const patientKey = localStorage.getItem("patientKey");

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

function isPastSlot(date, slotTime) {
  const now = new Date();
  const [h, m] = slotTime.split(":").map(Number);
  const slotDateTime = new Date(date);
  slotDateTime.setHours(h, m, 0, 0);
  return slotDateTime < now;
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
  { name: "Morning", start: 600, end: 900 },   // 10–3
  { name: "Evening", start: 1080, end: 1320 }, // 6–10
];

/* ================= FETCH ================= */
async function fetchAppointments() {
  let query = supabase.from("appointments").select("*");

  if (role !== "doctor") {
    query = query.eq("patient_key", patientKey);
  }

  const { data, error } = await query;
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
    morningSlots.innerHTML = `<p class="closed">Clinic Closed</p>`;
    eveningSlots.innerHTML = `<p class="closed">Clinic Closed</p>`;
    return;
  }

  const { data: appointments } = await supabase
    .from("appointments")
    .select("*")
    .eq("date", date);

  const bookedTimes = appointments.map(a => a.time);

  SESSIONS.forEach(session => {
    const target = session.name === "Morning" ? morningSlots : eveningSlots;

    for (let t = session.start; t + SLOT <= session.end; t += SLOT) {
      const slotTime = minsToTime(t);
      const btn = document.createElement("button");

      btn.type = "button";
      btn.className = "slot-btn";
      btn.textContent = format12(slotTime);

      /* 🔴 CANCELLED PAST SLOTS */
      if (isPastSlot(date, slotTime)) {
        btn.classList.add("slot-cancelled");
        btn.textContent = `${format12(slotTime)}`;
        btn.disabled = true;
      }
      /* 🔴 BOOKED FUTURE SLOTS */
      else if (bookedTimes.includes(slotTime)) {
        btn.classList.add("slot-booked");
        btn.disabled = true;
      }
      /* 🟢 AVAILABLE */
      else {
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

  const isDoctor = role === "doctor";

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
          const div = document.createElement("div");

          if (isDoctor) {
            div.innerHTML = `
              <strong>${i + 1}. ${a.name}</strong><br>
              Age: ${a.age}<br>
              <small>${format12(a.time)}</small>
            `;
          } else {
            div.innerHTML = `
              <strong>${a.name}</strong><br>
              Age: ${a.age}<br>
              <small>${format12(a.time)}</small>
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

  const { data, error } = await supabase
    .from("appointments")
    .insert({
      name: nameInput.value,
      age: ageInput.value,
      date: dateInput.value,
      time: hiddenTime.value,
      patient_key: patientKey,
    })
    .select()
    .single();

  if (error) {
    alert("Booking failed. Please try again.");
    return;
  }

  document.querySelector(".modal h3").innerText =
    "Appointment Confirmed";

  document.querySelector(".modal p").innerHTML = `
    <strong>Your appointment has been booked successfully.</strong><br><br>
    <strong>Time:</strong> ${format12(data.time)}<br><br>
    Please arrive <strong>10 minutes early</strong>.
  `;

  modalOverlay.classList.remove("hidden");

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
