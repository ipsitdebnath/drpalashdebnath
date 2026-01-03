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

/* ---------- Helpers ---------- */
function localDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function minsToTime(m) {
    return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function format12(t) {
    let [h, m] = t.split(":").map(Number);
    const p = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${String(m).padStart(2, "0")} ${p}`;
}

/* ---------- Date Restriction ---------- */
const today = new Date();
today.setHours(0, 0, 0, 0);

const maxDate = new Date(today);
maxDate.setDate(today.getDate() + 3);

dateInput.min = localDate(today);
dateInput.max = localDate(maxDate);

/* ---------- Storage ---------- */
let appointments = JSON.parse(localStorage.getItem("appointments")) || [];

/* ---------- Slot Config ---------- */
const SLOT = 20;
const SESSIONS = [
    { name: "Morning", start: 600, end: 900 },   // 10 AM – 3 PM
    { name: "Evening", start: 1080, end: 1320 }  // 6 PM – 10 PM
];

/* ---------- Slot Generator ---------- */
function updateSlots(date) {
    morningSlots.innerHTML = "";
    eveningSlots.innerHTML = "";
    hiddenTime.value = "";

    if (!date) return;

    const now = new Date();
    const isToday = date === localDate(now);
    const nowMin = now.getHours() * 60 + now.getMinutes();

    const booked = appointments
        .filter(a => a.date === date)
        .map(a => a.time);

    SESSIONS.forEach(session => {
        const target = session.name === "Morning" ? morningSlots : eveningSlots;

        for (let t = session.start; t + SLOT <= session.end; t += SLOT) {
            const slot = minsToTime(t);
            const div = document.createElement("div");
            div.className = "slot";
            div.textContent = format12(slot);

            if (booked.includes(slot) || (isToday && t < nowMin)) {
                div.classList.add("booked");
            } else {
                div.classList.add("available");
                div.onclick = () => {
                    document.querySelectorAll(".slot").forEach(s => s.classList.remove("selected"));
                    div.classList.add("selected");
                    hiddenTime.value = slot;
                };
            }

            target.appendChild(div);
        }
    });
}

/* ---------- Render Appointments ---------- */
function renderAppointments() {
    dateHeaders.innerHTML = "";
    appointmentRows.innerHTML = "";

    const grouped = {};
    appointments.forEach(a => (grouped[a.date] ||= []).push(a));

    Object.keys(grouped)
    .sort((a, b) => new Date(a) - new Date(b))
    .forEach(date => {
        const th = document.createElement("th");
        th.textContent = new Date(date).toDateString();
        dateHeaders.appendChild(th);

        const td = document.createElement("td");

        grouped[date]
            .sort((a, b) => a.time.localeCompare(b.time)) // time sort (already correct)
            .forEach(a => {
                const div = document.createElement("div");
                div.innerHTML = `
                    <strong>${format12(a.time)}</strong>
                    <span class="patient-name">${a.name}</span>
                    <span class="patient-age">(Age: ${a.age})</span>
                `;
                td.appendChild(div);
            });

        appointmentRows.appendChild(td);
    });
}

/* ---------- Events ---------- */
dateInput.addEventListener("change", () => {
    slotContainer.classList.remove("hidden");  // 👈 SHOW slots
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
    slotContainer.classList.add("hidden"); // 👈 HIDE again
    morningSlots.innerHTML = "";
    eveningSlots.innerHTML = "";

    renderAppointments();
});

modalBtn.onclick = () => modalOverlay.classList.add("hidden");

/* ---------- Initial Render ---------- */
renderAppointments();