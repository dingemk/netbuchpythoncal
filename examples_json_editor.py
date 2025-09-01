#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Examples JSON Editor
- Create and edit a JSON file with entries: file, name, image (optional), runtime (python|micropython)
- Simple Tkinter GUI: add/edit/remove entries, load/save JSON.

Run:
    python3 examples_json_editor.py

JSON schema produced:
{
  "examples": [
    {"file": "path/to/file.py", "name": "My Program", "image": "assets/pic.png", "runtime": "python"}
  ]
}
"""
import json
import os
import sys
import tkinter as tk
from tkinter import ttk, filedialog, messagebox

APP_TITLE = "Examples JSON Editor"
DEFAULT_JSON_NAME = "examples.json"

RUNTIMES = ("python", "micropython")

def file_exists_or_warn(path: str) -> bool:
    if not path:
        return False
    ok = os.path.exists(path)
    if not ok:
        # not fatal, just warn
        pass
    return ok

class ExamplesEditor(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title(APP_TITLE)
        self.geometry("920x520")
        self.minsize(760, 440)

        # State
        self.examples = []  # list of dicts
        self.current_json_path = None

        # Build UI
        self._build_menu()
        self._build_form()
        self._build_list()
        self._build_actions()
        self._layout()

    # ---------- UI Builders ----------
    def _build_menu(self):
        menubar = tk.Menu(self)
        filemenu = tk.Menu(menubar, tearoff=0)
        filemenu.add_command(label="Neu", command=self.cmd_new, accelerator="Ctrl+N")
        filemenu.add_command(label="Öffnen…", command=self.cmd_open, accelerator="Ctrl+O")
        filemenu.add_separator()
        filemenu.add_command(label="Speichern", command=self.cmd_save, accelerator="Ctrl+S")
        filemenu.add_command(label="Speichern unter…", command=self.cmd_save_as)
        filemenu.add_separator()
        filemenu.add_command(label="Beenden", command=self.destroy, accelerator="Ctrl+Q")
        menubar.add_cascade(label="Datei", menu=filemenu)
        self.config(menu=menubar)

        # Shortcuts
        self.bind_all("<Control-n>", lambda e: self.cmd_new())
        self.bind_all("<Control-o>", lambda e: self.cmd_open())
        self.bind_all("<Control-s>", lambda e: self.cmd_save())
        self.bind_all("<Control-q>", lambda e: self.destroy())

    def _build_form(self):
        self.frmForm = ttk.LabelFrame(self, text="Neuer/zu bearbeitender Eintrag")
        # Name
        self.varName = tk.StringVar()
        self.entName = ttk.Entry(self.frmForm, textvariable=self.varName, width=48)

        # File
        self.varFile = tk.StringVar()
        self.entFile = ttk.Entry(self.frmForm, textvariable=self.varFile, width=48)
        self.btnFile = ttk.Button(self.frmForm, text="Datei wählen…", command=self.choose_file)

        # Image (optional)
        self.varImage = tk.StringVar()
        self.entImage = ttk.Entry(self.frmForm, textvariable=self.varImage, width=48)
        self.btnImage = ttk.Button(self.frmForm, text="Bild wählen…", command=self.choose_image)

        # Runtime
        self.varRuntime = tk.StringVar(value="python")
        self.frmRuntime = ttk.Frame(self.frmForm)
        self.rbPy = ttk.Radiobutton(self.frmRuntime, text="Python", variable=self.varRuntime, value="python")
        self.rbMP = ttk.Radiobutton(self.frmRuntime, text="MicroPython", variable=self.varRuntime, value="micropython")

        # Buttons (add/update/clear)
        self.btnAddUpdate = ttk.Button(self.frmForm, text="Hinzufügen/Aktualisieren", command=self.add_or_update_entry)
        self.btnClear = ttk.Button(self.frmForm, text="Felder leeren", command=self.clear_form)

    def _build_list(self):
        self.frmList = ttk.LabelFrame(self, text="Einträge")
        # List with columns: name, runtime, file, image
        self.tree = ttk.Treeview(self.frmList, columns=("name","runtime","file","image"), show="headings", selectmode="browse")
        self.tree.heading("name", text="Name")
        self.tree.heading("runtime", text="Runtime")
        self.tree.heading("file", text="Datei")
        self.tree.heading("image", text="Bild (optional)")

        self.tree.column("name", width=180, anchor="w")
        self.tree.column("runtime", width=110, anchor="center")
        self.tree.column("file", width=360, anchor="w")
        self.tree.column("image", width=220, anchor="w")

        self.tree.bind("<<TreeviewSelect>>", self.on_select_row)
        self.tree.bind("<Double-1>", self.on_double_click_row)

        # Scrollbars
        vsb = ttk.Scrollbar(self.frmList, orient="vertical", command=self.tree.yview)
        hsb = ttk.Scrollbar(self.frmList, orient="horizontal", command=self.tree.xview)
        self.tree.configure(yscrollcommand=vsb.set, xscrollcommand=hsb.set)

        self.vsb = vsb
        self.hsb = hsb

    def _build_actions(self):
        self.frmActions = ttk.Frame(self)
        self.btnRemove = ttk.Button(self.frmActions, text="Ausgewählten entfernen", command=self.remove_selected)
        self.btnUp = ttk.Button(self.frmActions, text="▲ Nach oben", command=lambda: self.move_selected(-1))
        self.btnDown = ttk.Button(self.frmActions, text="▼ Nach unten", command=lambda: self.move_selected(+1))

    def _layout(self):
        pad = dict(padx=8, pady=8)

        # Form layout
        self.frmForm.grid(row=0, column=0, sticky="nsew", **pad)
        self.frmList.grid(row=1, column=0, sticky="nsew", **pad)
        self.frmActions.grid(row=2, column=0, sticky="ew", **pad)

        # Grid weights
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(1, weight=1)

        # Form fields
        r = 0
        ttk.Label(self.frmForm, text="Name").grid(row=r, column=0, sticky="w")
        self.entName.grid(row=r, column=1, sticky="ew", padx=(8,0)); r+=1

        ttk.Label(self.frmForm, text="Datei (file)").grid(row=r, column=0, sticky="w")
        self.entFile.grid(row=r, column=1, sticky="ew", padx=(8,0))
        self.btnFile.grid(row=r, column=2, sticky="w", padx=(8,0)); r+=1

        ttk.Label(self.frmForm, text="Bild (optional)").grid(row=r, column=0, sticky="w")
        self.entImage.grid(row=r, column=1, sticky="ew", padx=(8,0))
        self.btnImage.grid(row=r, column=2, sticky="w", padx=(8,0)); r+=1

        ttk.Label(self.frmForm, text="Runtime").grid(row=r, column=0, sticky="w")
        self.frmRuntime.grid(row=r, column=1, sticky="w", padx=(8,0))
        self.rbPy.grid(row=0, column=0, padx=(0,12))
        self.rbMP.grid(row=0, column=1)
        r += 1

        self.btnAddUpdate.grid(row=r, column=1, sticky="w", padx=(8,0))
        self.btnClear.grid(row=r, column=2, sticky="w", padx=(8,0))
        self.frmForm.grid_columnconfigure(1, weight=1)

        # List + scrollbars
        self.tree.grid(row=0, column=0, sticky="nsew")
        self.vsb.grid(row=0, column=1, sticky="ns")
        self.hsb.grid(row=1, column=0, sticky="ew")
        self.frmList.grid_rowconfigure(0, weight=1)
        self.frmList.grid_columnconfigure(0, weight=1)

        # Actions
        self.btnRemove.grid(row=0, column=0, padx=4)
        self.btnUp.grid(row=0, column=1, padx=4)
        self.btnDown.grid(row=0, column=2, padx=4)
        self.frmActions.grid_columnconfigure(3, weight=1)

    # ---------- Commands ----------
    def choose_file(self):
        path = filedialog.askopenfilename(title="Quelldatei auswählen",
                                          filetypes=[("Python", "*.py"), ("Alle", "*.*")])
        if path:
            # Store relative path if possible (to cwd)
            rel = self._try_make_relative(path)
            self.varFile.set(rel)

            # If name empty, infer from file stem
            if not self.varName.get().strip():
                base = os.path.basename(path)
                name = os.path.splitext(base)[0].replace("_", " ").title()
                self.varName.set(name)

def choose_image(self):
    try:
        # Wichtig: Tupel von Mustern, keine Semikolons!
        img_types = ("*.png", "*.jpg", "*.jpeg", "*.gif", "*.webp")
        path = filedialog.askopenfilename(
            title="Bild auswählen",
            filetypes=[("Bilder", img_types), ("Alle Dateien", "*.*")]
        )
    except Exception as e:
        messagebox.showerror(APP_TITLE, f"Bildwahl-Dialog Fehler:\n{e}")
        return
    if path:
        rel = self._try_make_relative(path)
        self.varImage.set(rel)

        
    def add_or_update_entry(self):
        file = self.varFile.get().strip()
        name = self.varName.get().strip()
        image = self.varImage.get().strip()
        runtime = self.varRuntime.get().strip().lower()

        # Validation
        if not file:
            messagebox.showwarning(APP_TITLE, "Bitte eine Datei (file) auswählen/angeben.")
            return
        if runtime not in RUNTIMES:
            messagebox.showwarning(APP_TITLE, "Bitte Runtime wählen (Python oder MicroPython).")
            return
        if not name:
            # auto-name from filename
            base = os.path.basename(file)
            name = os.path.splitext(base)[0].replace("_", " ").title()

        # Entry dict (omit empty image)
        entry = {"file": file, "name": name, "runtime": runtime}
        if image:
            entry["image"] = image

        # Update if file already exists, else add
        idx = self._find_index_by_file(file)
        if idx is None:
            self.examples.append(entry)
            self._tree_insert(entry)
        else:
            self.examples[idx] = entry
            self._tree_update(idx, entry)

        self.clear_form(keep_runtime=True)

    def clear_form(self, keep_runtime=False):
        self.varName.set("")
        self.varFile.set("")
        self.varImage.set("")
        if not keep_runtime:
            self.varRuntime.set("python")

    def remove_selected(self):
        sel = self.tree.selection()
        if not sel:
            return
        item_id = sel[0]
        index = self.tree.index(item_id)
        self.tree.delete(item_id)
        del self.examples[index]

    def move_selected(self, delta):
        sel = self.tree.selection()
        if not sel:
            return
        item_id = sel[0]
        index = self.tree.index(item_id)
        new_index = index + delta
        if new_index < 0 or new_index >= len(self.examples):
            return
        # swap in data
        self.examples[index], self.examples[new_index] = self.examples[new_index], self.examples[index]
        # rebuild tree to reflect new order
        self._rebuild_tree()
        # reselect moved row
        self.tree.selection_set(self.tree.get_children()[new_index])

    def on_select_row(self, event=None):
        sel = self.tree.selection()
        if not sel:
            return
        idx = self.tree.index(sel[0])
        entry = self.examples[idx]
        self.varName.set(entry.get("name", ""))
        self.varFile.set(entry.get("file", ""))
        self.varImage.set(entry.get("image", ""))
        self.varRuntime.set(entry.get("runtime", "python"))

    def on_double_click_row(self, event=None):
        # Double-click behaves same as select + focus form (already handled)
        pass

    def cmd_new(self):
        if self._maybe_discard_changes() is False:
            return
        self.examples = []
        self.current_json_path = None
        self._rebuild_tree()
        self.clear_form()
        self.title(f"{APP_TITLE}")

    def cmd_open(self):
        if self._maybe_discard_changes() is False:
            return
        path = filedialog.askopenfilename(
            title="JSON öffnen",
            filetypes=[("JSON", "*.json"), ("Alle Dateien", "*.*")],
            initialfile=DEFAULT_JSON_NAME
        )
        if not path:
            return
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            items = data.get("examples", [])
            if not isinstance(items, list):
                raise ValueError("Ungültiges Format: 'examples' muss ein Array sein.")
            self.examples = self._normalize_on_load(items)
            self.current_json_path = path
            self._rebuild_tree()
            self.title(f"{APP_TITLE} — {os.path.basename(path)}")
        except Exception as e:
            messagebox.showerror(APP_TITLE, f"Konnte JSON nicht laden:\n{e}")

    def cmd_save(self):
        if not self.current_json_path:
            return self.cmd_save_as()
        try:
            payload = {"examples": self.examples}
            with open(self.current_json_path, "w", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False, indent=2)
            messagebox.showinfo(APP_TITLE, f"Gespeichert:\n{self.current_json_path}")
        except Exception as e:
            messagebox.showerror(APP_TITLE, f"Fehler beim Speichern:\n{e}")

    def cmd_save_as(self):
        path = filedialog.asksaveasfilename(
            title="JSON speichern unter…",
            defaultextension=".json",
            filetypes=[("JSON", "*.json"), ("Alle Dateien", "*.*")],
            initialfile=DEFAULT_JSON_NAME
        )
        if not path:
            return
        self.current_json_path = path
        self.cmd_save()

    # ---------- Internal helpers ----------
    def _find_index_by_file(self, file_path: str):
        for i, e in enumerate(self.examples):
            if e.get("file") == file_path:
                return i
        return None

    def _normalize_on_load(self, items):
        norm = []
        for it in items:
            if not isinstance(it, dict):
                continue
            file = str(it.get("file", "")).strip()
            if not file:
                continue
            name = str(it.get("name", "")).strip()
            runtime = str(it.get("runtime", "")).strip().lower()
            image = str(it.get("image", "")).strip() if it.get("image") else ""

            if not name:
                base = os.path.basename(file)
                name = os.path.splitext(base)[0].replace("_", " ").title()
            if runtime not in RUNTIMES:
                runtime = "python"  # fallback

            entry = {"file": file, "name": name, "runtime": runtime}
            if image:
                entry["image"] = image
            norm.append(entry)
        return norm

    def _rebuild_tree(self):
        # clear
        for iid in self.tree.get_children():
            self.tree.delete(iid)
        # refill
        for e in self.examples:
            self._tree_insert(e)

    def _tree_insert(self, entry):
        vals = (entry.get("name",""), entry.get("runtime",""), entry.get("file",""), entry.get("image",""))
        self.tree.insert("", "end", values=vals)

    def _tree_update(self, index, entry):
        iid = self.tree.get_children()[index]
        vals = (entry.get("name",""), entry.get("runtime",""), entry.get("file",""), entry.get("image",""))
        self.tree.item(iid, values=vals)

    def _maybe_discard_changes(self):
        # Could add dirty-check; for simplicity, always OK
        return True

    @staticmethod
    def _try_make_relative(path: str) -> str:
        try:
            cwd = os.path.abspath(os.getcwd())
            ap = os.path.abspath(path)
            if ap.startswith(cwd + os.sep):
                return os.path.relpath(ap, cwd)
            return path
        except Exception:
            return path

def main():
    app = ExamplesEditor()
    app.mainloop()

if __name__ == "__main__":
    main()
