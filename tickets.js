const FEED = "calendar.ics";

function unfold(text) {
  return text.replace(/\r?\n[ \t]/g, "");
}

function valueOf(block, key) {
  const line = block
    .split(/\r?\n/)
    .find(
      item =>
        item.split(":")[0].split(";")[0].toUpperCase() === key
    );

  if (!line) return "";

  return line
    .slice(line.indexOf(":") + 1)
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

function parseDate(raw) {
  if (!raw) return null;

  if (/^\d{8}$/.test(raw)) {
    return new Date(
      Number(raw.slice(0, 4)),
      Number(raw.slice(4, 6)) - 1,
      Number(raw.slice(6, 8))
    );
  }

  const match = raw.match(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/
  );

  if (!match) return null;

  const [, year, month, day, hour, minute, second = "00", utc] = match;

  if (utc) {
    return new Date(
      Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second)
      )
    );
  }

  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  );
}

function parseEvents(text) {
  const blocks =
    unfold(text).match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) || [];

  return blocks
    .map(block => ({
      title: valueOf(block, "SUMMARY") || "Untitled concert",
      start: parseDate(valueOf(block, "DTSTART")),
      description: valueOf(block, "DESCRIPTION")
    }))
    .filter(event => event.start && !Number.isNaN(event.start.getTime()));
}

function addTickets(index, person, quantity, event) {
  const cleanedName = person.trim();

  if (!cleanedName || quantity <= 0) return;

  if (!index[cleanedName]) {
    index[cleanedName] = {
      total: 0,
      concerts: []
    };
  }

  index[cleanedName].total += quantity;
  index[cleanedName].concerts.push({
    title: event.title,
    date: event.start,
    quantity
  });
}

function parseTicketInformation(events) {
  const index = {};

  for (const event of events) {
    const description = event.description || "";

    const hasTicketMatches = description.matchAll(
      /([A-Z][A-Za-z'-]*) has (\d+|a|an) tickets?/gi
    );

    for (const match of hasTicketMatches) {
      const person = match[1];
      const quantity =
        match[2].toLowerCase() === "a" ||
        match[2].toLowerCase() === "an"
          ? 1
          : Number(match[2]);

      addTickets(index, person, quantity, event);
    }

    const ticketListMatch = description.match(
      /Tickets?:\s*([^\n]+)/i
    );

    if (ticketListMatch) {
      const names = ticketListMatch[1]
        .split(/[;,]|(?:\s+&\s+)/)
        .map(name => name.trim())
        .filter(Boolean);

      for (const name of names) {
        addTickets(index, name, 1, event);
      }
    }
  }

  return index;
}

function formatDate(date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function renderTicketIndex(index) {
  const root = document.getElementById("ticket-index");

  const entries = Object.entries(index).sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  if (!entries.length) {
    root.innerHTML = `
      <div class="empty">
        No ticket information was found in the upcoming calendar events.
      </div>
    `;
    return;
  }

  const grid = document.createElement("div");
  grid.className = "ticket-card-grid";

  for (const [person, details] of entries) {
    const concerts = details.concerts.sort(
      (a, b) => a.date - b.date
    );

    const nextConcert = concerts[0];

    const concertList = concerts
      .map(concert => {
        const quantityText =
          concert.quantity > 1
            ? ` · ${concert.quantity} tickets`
            : "";

        return `
          <li class="person-show">
            <strong>${concert.title}</strong>
            <span>
              ${formatDate(concert.date)}${quantityText}
            </span>
          </li>
        `;
      })
      .join("");

    const card = document.createElement("article");
    card.className = "person-card";

    card.innerHTML = `
      <div class="person-card-header">
        <div>
          <p class="person-label">Group member</p>
          <h3>${person}</h3>
        </div>

        <div class="ticket-total">
          <strong>${details.total}</strong>
          <span>
            ${details.total === 1 ? "ticket" : "tickets"}
          </span>
        </div>
      </div>

      <div class="person-summary">
        <div>
          <span>Upcoming shows</span>
          <strong>${concerts.length}</strong>
        </div>

        <div>
          <span>Next show</span>
          <strong>${nextConcert.title}</strong>
          <small>${formatDate(nextConcert.date)}</small>
        </div>
      </div>

      <div class="person-shows">
        <h4>Upcoming concerts</h4>
        <ul>
          ${concertList}
        </ul>
      </div>
    `;

    grid.appendChild(card);
  }

  root.innerHTML = "";
  root.appendChild(grid);
}

async function loadTickets() {
  const status = document.getElementById("ticket-status");

  try {
    const response = await fetch(FEED, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Calendar request failed: ${response.status}`);
    }

    const text = await response.text();
    const events = parseEvents(text);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcomingEvents = events.filter(
      event => event.start >= today
    );

    const ticketIndex = parseTicketInformation(upcomingEvents);

    renderTicketIndex(ticketIndex);
    status.textContent = "Calendar loaded";
  } 
  catch (error) {
    console.error(error);

    status.textContent = "Calendar unavailable";

    document.getElementById("ticket-index").innerHTML = `
      <div class="empty">
        Ticket information could not be loaded.
      </div>
    `;
  }
}

loadTickets();