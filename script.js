import { supabase } from "./supabase.js";

/* ===== ROLE DETECTION (URL BASED) ===== */
const params = new URLSearchParams(window.location.search);
const role = params.get("mode") === "doctor" ? "doctor" : "patient";

/* ===== DOCTOR VIEW UI CONTROL ===== */
if (role === "doctor") {
  document.querySelector(".clinic-info")?.classList.add("hidden");
  document.querySelector(".right-stack")?.classList.add("hidden");
  document.querySelector(".extra-info")?.classList.add("hidden");
  document.querySelector(".faq-section")?.classList.add("hidden");
  document.querySelector(".stickyheader")?.classList.add("hidden");
  document.querySelector("footer")?.classList.add("hidden");
  document.title = "Doctor Dashboard | Dr. Palash Debnath";
}

/* ===== PATIENT KEY ===== */
if (!localStorage.getItem("patientKey")) {
  localStorage.setItem(
    "patientKey",
    "patient_" + Date.now() + "_" + Math.random().toString(36).slice(2)
  );
}
const patientKey = localStorage.getItem("patientKey");

/* ===== ELEMENTS ===== */
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

/* ===== HELPERS ===== */
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
  const [h, m] = slotTime.split(":").map(Number);
  const dt = new Date(date);
  dt.setHours(h, m, 0, 0);
  return dt < new Date();
}

/* ===== DATE LIMIT ===== */
const today = new Date();
today.setHours(0, 0, 0, 0);

const maxDate = new Date(today);
maxDate.setDate(today.getDate() + 3);

dateInput.min = localDate(today);
dateInput.max = localDate(maxDate);

/* ===== SLOT CONFIG ===== */
const SLOT = 20;
const SESSIONS = [
  { name: "Morning", start: 600, end: 900 },
  { name: "Evening", start: 1080, end: 1320 },
];

/* ===== FETCH ===== */
async function fetchAppointments() {
  let query = supabase.from("appointments").select("*");
  if (role !== "doctor") query = query.eq("patient_key", patientKey);
  const { data } = await query;
  return data || [];
}

/* ===== DELETE APPOINTMENT ===== */
async function deleteAppointment(id, patientName) {
  if (!confirm(`Are you sure you want to delete the appointment for:\n\n${patientName}?`)) return;

  const { error } = await supabase.from("appointments").delete().eq("id", id);
  if (error) return alert("Failed to delete appointment");

  renderAppointments();
  if (dateInput?.value) updateSlots(dateInput.value);
}
window.deleteAppointment = deleteAppointment;

/* ===== SLOT GENERATION ===== */
async function updateSlots(date) {
  morningSlots.innerHTML = "";
  eveningSlots.innerHTML = "";
  hiddenTime.value = "";

  if (!date) return;

  const { data } = await supabase.from("appointments").select("*").eq("date", date);
  const bookedTimes = data.map(a => a.time);

  SESSIONS.forEach(session => {
    const target = session.name === "Morning" ? morningSlots : eveningSlots;

    for (let t = session.start; t + SLOT <= session.end; t += SLOT) {
      const slotTime = minsToTime(t);
      const btn = document.createElement("button");

      btn.type = "button";
      btn.className = "slot-btn";
      btn.textContent = format12(slotTime);

      if (isPastSlot(date, slotTime) || bookedTimes.includes(slotTime)) {
        btn.disabled = true;
      } else {
        btn.onclick = () => {
          document.querySelectorAll(".slot-btn").forEach(b => b.classList.remove("slot-selected"));
          btn.classList.add("slot-selected");
          hiddenTime.value = slotTime;
        };
      }

      target.appendChild(btn);
    }
  });
}

/* ===== RENDER APPOINTMENTS ===== */
async function renderAppointments() {
  dateHeaders.innerHTML = "";
  appointmentRows.innerHTML = "";

  const appointments = await fetchAppointments();
  if (!appointments.length) return;

  const grouped = {};
  appointments.forEach(a => (grouped[a.date] ??= []).push(a));

  Object.keys(grouped).sort().forEach(date => {
    const th = document.createElement("th");
    th.textContent = new Date(date).toDateString();
    dateHeaders.appendChild(th);

    const td = document.createElement("td");

    grouped[date].sort((a, b) => a.time.localeCompare(b.time)).forEach((a, i) => {
      const div = document.createElement("div");

      if (role === "doctor") {
        div.innerHTML = `
          <div class="appt-row">
            <div class="appt-serial">${i + 1}.</div>
            <div class="appt-details">
              <div class="appt-name">${a.name}</div>
              <div class="appt-age">Age: ${a.age}</div>
              <div class="appt-time">${format12(a.time)}</div>
            </div>
          </div>
          <button class="delete-btn"
            onclick="deleteAppointment('${a.id}', '${a.name.replace(/'/g, "\\'")}')">
            ❌ Delete
          </button>
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

/* ===== EVENTS ===== */
dateInput?.addEventListener("change", () => {
  slotContainer.classList.remove("hidden");
  updateSlots(dateInput.value);
});

form?.addEventListener("submit", async e => {
  e.preventDefault();
  if (!hiddenTime.value) return alert("Please select a time slot");

  const { error } = await supabase.from("appointments").insert({
    name: nameInput.value,
    age: ageInput.value,
    date: dateInput.value,
    time: hiddenTime.value,
    patient_key: patientKey,
  });

  if (error) return alert("Booking failed");

  modalOverlay.classList.remove("hidden");
  form.reset();
  slotContainer.classList.add("hidden");
  renderAppointments();
});

modalBtn?.addEventListener("click", () => modalOverlay.classList.add("hidden"));

/* ===== INIT ===== */
renderAppointments();
