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
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

/* ================= DATE RESTRICTIONS ================= */
const today = new Date();
today.setHours(0, 0, 0, 0);

const maxDate = new Date(today);
maxDate.setDate(today.getDate() + 3);

dateInput.min = localDate(today);
dateInput.max = localDate(maxDate);

/* ================= STORAGE ================= */
let appointments = JSON.parse(localStorage.getItem("appointments")) || [];

/* ================= SLOT CONFIG ================= */
const SLOT = 20;
const SESSIONS = [
    { name: "Morning", start: 600, end: 900 },
    { name: "Evening", start: 1080, end: 1320 }
];

/* ================= SLOT GENERATION ================= */
function updateSlots(date) {
    morningSlots.innerHTML = "";
    eveningSlots.innerHTML = "";
    hiddenTime.value = "";

    if (!date) return;

    const selectedDate = new Date(date);
    const isSaturday = selectedDate.getDay() === 6;

    if (isSaturday) {
        slotContainer.classList.remove("hidden");
        morningSlots.innerHTML = `<p style="color:#999">Clinic Closed</p>`;
        eveningSlots.innerHTML = `<p style="color:#999">Clinic Closed</p>`;
        return;
    }

    const now = new Date();
    const isToday = date === localDate(now);
    const nowMin = now.getHours() * 60 + now.getMinutes();

    const bookedTimes = appointments
        .filter(a => a.date === date)
        .map(a => a.time);

    SESSIONS.forEach(session => {
        const target = session.name === "Morning" ? morningSlots : eveningSlots;

        for (let t = session.start; t + SLOT <= session.end; t += SLOT) {
            const slotTime = minsToTime(t);
            const slot = document.createElement("button");

            slot.type = "button";
            slot.className = "slot-btn";
            slot.textContent = format12(slotTime);

            if (bookedTimes.includes(slotTime) || (isToday && t < nowMin)) {
                slot.disabled = true;
                slot.classList.add("slot-booked");
            } else {
                slot.onclick = () => {
                    document
                        .querySelectorAll(".slot-btn")
                        .forEach(b => b.classList.remove("slot-selected"));

                    slot.classList.add("slot-selected");
                    hiddenTime.value = slotTime;
                };
            }

            target.appendChild(slot);
        }
    });
}

/* ================= RENDER APPOINTMENTS ================= */
function renderAppointments() {
    dateHeaders.innerHTML = "";
    appointmentRows.innerHTML = "";

    if (appointments.length === 0) return;

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

            let serial = 1;

            grouped[date]
                .sort((a, b) => a.time.localeCompare(b.time))
                .forEach(a => {
                    const div = document.createElement("div");
                    div.className = "appointment-card";

                    div.innerHTML = `
      <strong>${serial}. ${a.name}</strong> (Age: ${a.age})<br>
      <span>${format12(a.time)}</span>
    `;

                    serial++; // increment serial number
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

form.addEventListener("submit", e => {
    e.preventDefault();

    if (!hiddenTime.value) {
        alert("Please select a time slot");
        return;
    }

    appointments.push({
        name: nameInput.value,
        age: ageInput.value,
        date: dateInput.value,
        time: hiddenTime.value
    });

    localStorage.setItem("appointments", JSON.stringify(appointments));

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
