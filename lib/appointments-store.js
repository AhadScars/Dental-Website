const fs = require("fs");
const path = require("path");

const FILE_PATH = path.join(__dirname, "..", "data", "appointments.json");
const GIST_FILENAME = "elegancia-appointments.json";

function emptyList() {
  return [];
}

function githubHeaders() {
  const token = process.env.GITHUB_TOKEN || process.env.APPOINTMENTS_GITHUB_TOKEN || "";
  return {
    Authorization: "Bearer " + token,
    Accept: "application/vnd.github+json",
    "User-Agent": "elegancia-dental",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function hasGithubToken() {
  return Boolean(process.env.GITHUB_TOKEN || process.env.APPOINTMENTS_GITHUB_TOKEN);
}

function hasUpstash() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

function storeKind() {
  if (hasUpstash()) return "upstash";
  if (hasGithubToken()) return "gist";
  return "file";
}

function readFileList() {
  try {
    const raw = fs.readFileSync(FILE_PATH, "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : emptyList();
  } catch (err) {
    return emptyList();
  }
}

function writeFileList(list) {
  fs.mkdirSync(path.dirname(FILE_PATH), { recursive: true });
  fs.writeFileSync(FILE_PATH, JSON.stringify(list, null, 2), "utf8");
}

async function upstashGet() {
  const res = await fetch(process.env.UPSTASH_REDIS_REST_URL + "/get/elegancia-appointments", {
    headers: { Authorization: "Bearer " + process.env.UPSTASH_REDIS_REST_TOKEN },
  });
  const json = await res.json();
  if (!json || json.result == null) return emptyList();
  try {
    const parsed = JSON.parse(json.result);
    return Array.isArray(parsed) ? parsed : emptyList();
  } catch (err) {
    return emptyList();
  }
}

async function upstashSet(list) {
  const res = await fetch(process.env.UPSTASH_REDIS_REST_URL + "/set/elegancia-appointments", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + process.env.UPSTASH_REDIS_REST_TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(JSON.stringify(list)),
  });
  if (!res.ok) throw new Error("Could not save appointments to Upstash.");
}

async function findOrCreateGist() {
  const listRes = await fetch("https://api.github.com/gists?per_page=100", { headers: githubHeaders() });
  if (!listRes.ok) throw new Error("GitHub token was rejected. Create a token with the gist scope.");
  const gists = await listRes.json();
  const found = (gists || []).find(function (gist) {
    return gist.files && gist.files[GIST_FILENAME];
  });
  if (found) return found.id;
  const created = await fetch("https://api.github.com/gists", {
    method: "POST",
    headers: githubHeaders(),
    body: JSON.stringify({
      description: "Elegancia Dental appointments",
      public: false,
      files: {
        [GIST_FILENAME]: { content: "[]" },
      },
    }),
  });
  if (!created.ok) throw new Error("Could not create the appointments gist.");
  const body = await created.json();
  return body.id;
}

async function gistGet() {
  const id = await findOrCreateGist();
  const res = await fetch("https://api.github.com/gists/" + id, { headers: githubHeaders() });
  if (!res.ok) throw new Error("Could not read appointments from GitHub.");
  const body = await res.json();
  const file = body.files && body.files[GIST_FILENAME];
  if (!file || !file.content) return emptyList();
  try {
    const parsed = JSON.parse(file.content);
    return Array.isArray(parsed) ? parsed : emptyList();
  } catch (err) {
    return emptyList();
  }
}

async function gistSet(list) {
  const id = await findOrCreateGist();
  const res = await fetch("https://api.github.com/gists/" + id, {
    method: "PATCH",
    headers: githubHeaders(),
    body: JSON.stringify({
      files: {
        [GIST_FILENAME]: { content: JSON.stringify(list, null, 2) },
      },
    }),
  });
  if (!res.ok) throw new Error("Could not save appointments to GitHub.");
}

async function listAppointments() {
  if (hasUpstash()) return upstashGet();
  if (hasGithubToken()) return gistGet();
  return readFileList();
}

async function saveAppointments(list) {
  if (hasUpstash()) return upstashSet(list);
  if (hasGithubToken()) return gistSet(list);
  writeFileList(list);
}

async function upsertAppointment(appointment) {
  if (!appointment || !appointment.id) {
    throw new Error("Appointment id is required.");
  }
  const list = await listAppointments();
  let found = false;
  const next = list.map(function (item) {
    if (item.id !== appointment.id) return item;
    found = true;
    return Object.assign({}, item, appointment, { updatedAt: appointment.updatedAt || new Date().toISOString() });
  });
  if (!found) next.push(Object.assign({}, appointment, { updatedAt: appointment.updatedAt || new Date().toISOString() }));
  await saveAppointments(next);
  return next.find(function (item) {
    return item.id === appointment.id;
  });
}

module.exports = {
  storeKind,
  hasGithubToken,
  hasUpstash,
  listAppointments,
  saveAppointments,
  upsertAppointment,
};
