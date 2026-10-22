import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadRenewals } from "../scripts/renewals.mjs";

// Writes text to a renewals file in a throwaway folder and returns its path.
function renewalsFile(t, text) {
  const dir = mkdtempSync(join(tmpdir(), "patchlife-renewals-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, "renewals.yml");
  writeFileSync(file, text);
  return file;
}

// Only its shape is checked, so the owner can fill in, add and remove items without touching this test.
test("the real ops/renewals.yml loads", () => {
  assert.ok(loadRenewals().length > 0);
});

test("a due date may be quoted or not, null or left blank, and the note left out", (t) => {
  const file = renewalsFile(t, '- name: a\n  due: "2027-01-15"\n  note: quoted\n- name: b\n  due: 2028-02-29\n- name: c\n  due: null\n- name: d\n  due:\n');
  assert.deepEqual(loadRenewals(file), [
    { name: "a", due: "2027-01-15", note: "quoted" },
    { name: "b", due: "2028-02-29" },
    { name: "c", due: null },
    { name: "d", due: null },
  ]);
  assert.deepEqual(loadRenewals(renewalsFile(t, "[]\n")), []);
});

test("anything but a list of { name, due, note } items is refused with the file, the item and what's wrong", (t) => {
  const cases = [
    ["", /: must be a list of items/],
    ["# nothing yet\n", /: must be a list of items/],
    ["name: a\ndue: null\n", /: must be a list of items/],
    ["- just text\n", /: item 1 must have name, due and an optional note/],
    ["-\n", /: item 1 must have name, due and an optional note/],
    ["- [a, b]\n", /: item 1 must have name, due and an optional note/],
    ["- due: null\n", /: item 1 needs a name/],
    ['- name: ""\n  due: null\n', /: item 1 needs a name/],
    ['- name: "  "\n  due: null\n', /: item 1 needs a name/],
    ["- name: 5\n  due: null\n", /: item 1 needs a name/],
    ["- name: a\n", /: item 1 \(a\): due must be null or a real date written "YYYY-MM-DD", not missing/],
    ['- name: a\n  due: "2027-02-30"\n', /: item 1 \(a\): due must be null or a real date written "YYYY-MM-DD", not "2027-02-30"/],
    ['- name: a\n  due: "2027-13-01"\n', /not "2027-13-01"/],
    ['- name: a\n  due: "2027-1-5"\n', /not "2027-1-5"/],
    ['- name: a\n  due: "2027-01-05T00:00:00Z"\n', /not "2027-01-05T00:00:00Z"/],
    // Date reads this as the year 10000, and its ISO form starts with the same ten characters.
    ['- name: a\n  due: "+010000-01"\n', /not "\+010000-01"/],
    ["- name: a\n  due: 20270105\n", /not 20270105/],
    ["- name: a\n  due: soon\n", /not "soon"/],
    ["- name: a\n  due: null\n  note: 5\n", /: item 1 \(a\): note must be text, or left out/],
    ["- name: a\n  due: null\n  note:\n", /: item 1 \(a\): note must be text, or left out/],
    ['- name: a\n  due: null\n  dua: "2027-01-01"\n', /: item 1 has an unknown field "dua" \(use name, due and note\)/],
    ["- name: a\n  due: null\n- name: b\n  due: next year\n", /: item 2 \(b\): due must be null/],
    ["- name: [a\n", /renewals\.yml: /],
  ];
  for (const [text, message] of cases) {
    const file = renewalsFile(t, text);
    assert.throws(() => loadRenewals(file), (err) => err.message.startsWith(`${file}: `) && message.test(err.message), JSON.stringify(text));
  }
  assert.throws(() => loadRenewals(join(tmpdir(), "patchlife-no-such-renewals.yml")), /patchlife-no-such-renewals\.yml: ENOENT/);
});
