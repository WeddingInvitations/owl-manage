const newAthletesByKey = new Map();
let modalInitialized = false;

export function setNewAthleteNames(key, category, monthLabel, athletes, athleteIds) {
  const names = athletes
    .filter((athlete) => athleteIds.has(athlete.id))
    .map((athlete) => athlete.name?.trim() || "Sin nombre")
    .sort((first, second) => first.localeCompare(second, "es"));

  newAthletesByKey.set(key, {
    title: `${category} · ${monthLabel}`,
    names,
  });
}

function renderNames(list, names) {
  list.replaceChildren();
  if (names.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.textContent = "No hay altas nuevas para este mes.";
    list.appendChild(emptyItem);
    return;
  }

  names.forEach((name) => {
    const item = document.createElement("li");
    item.textContent = name;
    list.appendChild(item);
  });
}

export function initializeNewAthleteModal() {
  if (modalInitialized) return;
  const modal = document.getElementById("newAthletesModal");
  const title = document.getElementById("newAthletesModalTitle");
  const list = document.getElementById("newAthletesList");
  const closeButton = document.getElementById("newAthletesModalClose");
  if (!modal || !title || !list || !closeButton) return;

  modalInitialized = true;
  let opener = null;
  const close = () => {
    modal.classList.add("hidden");
    opener?.focus();
  };

  document.querySelectorAll("[data-new-athletes-key]").forEach((button) => {
    button.addEventListener("click", () => {
      const summary = newAthletesByKey.get(button.dataset.newAthletesKey);
      if (!summary) return;
      opener = button;
      title.textContent = summary.title;
      renderNames(list, summary.names);
      modal.classList.remove("hidden");
      closeButton.focus();
    });
  });

  closeButton.addEventListener("click", close);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) close();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.classList.contains("hidden")) close();
  });
}
