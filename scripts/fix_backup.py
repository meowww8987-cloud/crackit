"""Fix the Data Export/Backup in SettingsTab to export ALL 16 localStorage stores."""
import re

filepath = '/home/z/my-project/src/components/tabs/SettingsTab.tsx'
with open(filepath, 'r') as f:
    content = f.read()

# The old exportData function (from line 787 to ~806)
old_export = """  const exportData = () => {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: s,
      targets: JSON.parse(localStorage.getItem('neet-targets') || '{}'),
      history: JSON.parse(localStorage.getItem('neet-history') || '{}'),
      syllabus: JSON.parse(localStorage.getItem('neet-syllabus') || '{}'),
      tests: JSON.parse(localStorage.getItem('neet-tests') || '{}'),
      recall: JSON.parse(localStorage.getItem('neet-recall') || '{}'),
      timetable: JSON.parse(localStorage.getItem('neet-timetable') || '{}'),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `neet-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };"""

new_export = """  const exportData = () => {
    // Export ALL localStorage keys starting with 'neet-' (16 stores total)
    const allKeys = Object.keys(localStorage).filter((k) => k.startsWith('neet-'));
    const data: Record<string, any> = {
      _meta: {
        version: 2,
        exportedAt: new Date().toISOString(),
        appVersion: 'NEET 2027 Study Tracker',
        storeCount: allKeys.length,
      },
    };
    for (const key of allKeys) {
      try {
        data[key] = JSON.parse(localStorage.getItem(key) || 'null');
      } catch {
        data[key] = localStorage.getItem(key);
      }
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `neet-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };"""

if old_export in content:
    content = content.replace(old_export, new_export)
    print("✅ Export function updated")
else:
    print("❌ Export function not found — checking with regex")
    # Try regex match
    pattern = r'  const exportData = \(\) => \{.*?URL\.revokeObjectURL\(url\);\s*\};'
    match = re.search(pattern, content, re.DOTALL)
    if match:
        content = content[:match.start()] + new_export + content[match.end():]
        print("✅ Export function updated via regex")
    else:
        print("❌ Could not find export function")

# Fix the handleImportFile to show sleep count
old_counts = """        const counts: Record<string, number> = {
          targets: data.targets?.byDate ? Object.values(data.targets.byDate).flat().length : 0,
          sessions: data.history?.sessions?.length || 0,
          subjects: data.syllabus?.subjects?.length || 0,
          chapters: data.syllabus?.chapters?.length || 0,
          lectures: data.syllabus?.lectures?.length || 0,
          tests: data.tests?.tests?.length || 0,
        };"""

new_counts = """        const counts: Record<string, number> = {
          targets: data['neet-targets']?.state?.byDate ? Object.values(data['neet-targets'].state.byDate).flat().length : 0,
          sessions: data['neet-history']?.state?.sessions?.length || 0,
          subjects: data['neet-syllabus']?.state?.subjects?.length || 0,
          chapters: data['neet-syllabus']?.state?.chapters?.length || 0,
          lectures: data['neet-syllabus']?.state?.lectures?.length || 0,
          tests: data['neet-tests']?.state?.tests?.length || 0,
          sleep: data['neet-sleep']?.state?.history?.length || 0,
          storeCount: Object.keys(data).filter((k) => k.startsWith('neet-')).length,
        };"""

if old_counts in content:
    content = content.replace(old_counts, new_counts)
    print("✅ Import preview counts updated")
else:
    print("❌ Import preview counts not found")

# Fix confirmImport to export ALL stores
old_import = """  const confirmImport = () => {
    if (!importPreview) return;
    // Save current data for undo
    const backup: Record<string, string> = {};
    ['neet-settings', 'neet-targets', 'neet-history', 'neet-syllabus', 'neet-tests', 'neet-recall', 'neet-timetable'].forEach((key) => {
      const val = localStorage.getItem(key);
      if (val) backup[key] = val;
    });
    localStorage.setItem('neet-pre-import-backup', JSON.stringify(backup));

    // Write imported data
    const { data } = importPreview;
    if (data.settings) localStorage.setItem('neet-settings', JSON.stringify(data.settings));
    if (data.targets) localStorage.setItem('neet-targets', JSON.stringify(data.targets));
    if (data.history) localStorage.setItem('neet-history', JSON.stringify(data.history));
    if (data.syllabus) localStorage.setItem('neet-syllabus', JSON.stringify(data.syllabus));
    if (data.tests) localStorage.setItem('neet-tests', JSON.stringify(data.tests));
    if (data.recall) localStorage.setItem('neet-recall', JSON.stringify(data.recall));
    if (data.timetable) localStorage.setItem('neet-timetable', JSON.stringify(data.timetable));

    setHasUndoData(true);
    setImportPreview(null);
    alert('Backup imported successfully! Reloading...');
    window.location.reload();
  };"""

new_import = """  const confirmImport = () => {
    if (!importPreview) return;
    // Save current data for undo (ALL neet-* keys)
    const backup: Record<string, string> = {};
    Object.keys(localStorage).filter((k) => k.startsWith('neet-')).forEach((key) => {
      const val = localStorage.getItem(key);
      if (val) backup[key] = val;
    });
    localStorage.setItem('neet-pre-import-backup', JSON.stringify(backup));

    // Write imported data — restore ALL neet-* keys from backup file
    const { data } = importPreview;
    Object.keys(data).filter((k) => k.startsWith('neet-')).forEach((key) => {
      if (data[key] !== null && data[key] !== undefined) {
        localStorage.setItem(key, JSON.stringify(data[key]));
      }
    });

    setHasUndoData(true);
    setImportPreview(null);
    alert('Backup imported successfully! Reloading...');
    window.location.reload();
  };"""

if old_import in content:
    content = content.replace(old_import, new_import)
    print("✅ Import function updated")
else:
    print("❌ Import function not found — trying regex")
    pattern = r'  const confirmImport = \(\) => \{.*?window\.location\.reload\(\);\s*\};'
    match = re.search(pattern, content, re.DOTALL)
    if match:
        content = content[:match.start()] + new_import + content[match.end():]
        print("✅ Import function updated via regex")
    else:
        print("❌ Could not find import function")

# Fix restorePreviousData to restore ALL stores
old_restore = """  const restorePreviousData = () => {
    const backupStr = localStorage.getItem('neet-pre-import-backup');
    if (!backupStr) return;
    const backup = JSON.parse(backupStr);
    // Clear current and restore backup
    ['neet-settings', 'neet-targets', 'neet-history', 'neet-syllabus', 'neet-tests', 'neet-recall', 'neet-timetable'].forEach((key) => {
      if (backup[key]) localStorage.setItem(key, backup[key]);
    });
    localStorage.removeItem('neet-pre-import-backup');
    setHasUndoData(false);
    alert('Previous data restored! Reloading...');
    window.location.reload();
  };"""

new_restore = """  const restorePreviousData = () => {
    const backupStr = localStorage.getItem('neet-pre-import-backup');
    if (!backupStr) return;
    const backup = JSON.parse(backupStr);
    // Clear current neet-* and restore backup
    Object.keys(localStorage).filter((k) => k.startsWith('neet-') && k !== 'neet-pre-import-backup').forEach((key) => {
      localStorage.removeItem(key);
    });
    Object.keys(backup).forEach((key) => {
      if (backup[key]) localStorage.setItem(key, backup[key]);
    });
    localStorage.removeItem('neet-pre-import-backup');
    setHasUndoData(false);
    alert('Previous data restored! Reloading...');
    window.location.reload();
  };"""

if old_restore in content:
    content = content.replace(old_restore, new_restore)
    print("✅ Restore function updated")
else:
    print("❌ Restore function not found — trying regex")
    pattern = r'  const restorePreviousData = \(\) => \{.*?window\.location\.reload\(\);\s*\};'
    match = re.search(pattern, content, re.DOTALL)
    if match:
        content = content[:match.start()] + new_restore + content[match.end():]
        print("✅ Restore function updated via regex")
    else:
        print("❌ Could not find restore function")

with open(filepath, 'w') as f:
    f.write(content)

print("\nDone!")
