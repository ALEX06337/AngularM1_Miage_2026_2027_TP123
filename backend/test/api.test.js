import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { createApp } from "../src/app.js";
import { User } from "../src/models/User.js";
import { Track } from "../src/models/Track.js";

let server, base;

test.before(async () => {
  server = createApp().listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => server.close());

test("health sans dépendre de MongoDB", async () => {
  const r = await fetch(base + "/api/health");
  assert.equal(r.status, 200);
  assert.equal((await r.json()).status, "ok");
});

test("schémas Mongoose et relation", () => {
  const u = new User({
    name: "Test",
    email: "TEST@example.com",
    password: "12345678",
  });

  assert.equal(u.email, "test@example.com");
  const t = new Track({
    ownerId: new mongoose.Types.ObjectId(),
    title: "Blues",
    originalName: "b.mp3",
    storedName: "x.mp3",
    mimeType: "audio/mpeg",
    size: 42,
  });
  
  assert.equal(t.title, "Blues");
  assert.equal(Track.schema.path("ownerId").options.ref, "User");
});

// --- TP3 : tests de contrat/sécurité, sans MongoDB ---------------------
// Ces cas sont rejetés par le middleware `auth` ou par Multer AVANT tout
// accès à la base : ils restent donc exécutables sans connexion Mongo.

const bearer = () => ({
  Authorization: `Bearer ${jwt.sign(
    { sub: new mongoose.Types.ObjectId().toString(), email: "t@example.com" },
    process.env.JWT_SECRET || "tp1-development-secret",
  )}`,
});

test("401 sans JWT sur les routes protégées", async () => {
  const id = new mongoose.Types.ObjectId().toString();
  for (const [method, path] of [
    ["GET", "/api/tracks"],
    ["POST", "/api/tracks"],
    ["DELETE", `/api/tracks/${id}`],
  ]) {
    const r = await fetch(base + path, { method });
    assert.equal(r.status, 401, `${method} ${path}`);
  }
});

test("401 avec un JWT invalide ou signé avec un autre secret", async () => {
  for (const token of ["pas-un-jwt", jwt.sign({ sub: "x" }, "mauvais-secret")]) {
    const r = await fetch(base + "/api/tracks", {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(r.status, 401);
  }
});

test("400 pour un upload sans fichier", async () => {
  const body = new FormData();
  body.append("title", "Sans fichier");
  const r = await fetch(base + "/api/tracks", { method: "POST", headers: bearer(), body });
  assert.equal(r.status, 400);
  assert.equal((await r.json()).message, "Fichier audio requis");
});

test("400 pour un type MIME refusé", async () => {
  const body = new FormData();
  body.append("title", "Texte");
  body.append("audio", new Blob(["hello"], { type: "text/plain" }), "note.txt");
  const r = await fetch(base + "/api/tracks", { method: "POST", headers: bearer(), body });
  assert.equal(r.status, 400);
});
