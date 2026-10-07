export function hasAccountDraft(storage: Storage, personId: string) {
  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (
        key === "uuse-timetable-draft:" + personId ||
        key?.startsWith("uuse-publish-draft:" + personId + ":") ||
        key?.startsWith("uuse-need-draft:" + personId + ":") ||
        key?.startsWith("uuse-message-draft:" + personId + ":")
      )
        return true;
    }
    return false;
  } catch {
    return true;
  }
}
export function clearAccountStorage(storage: Storage, personId: string) {
  let cleared = true;
  const keys = [
    "uuse-timetable-draft:" + personId,
    "uuse-favorites:" + personId,
  ];
  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (
        key?.startsWith("uuse-publish-draft:" + personId + ":") ||
        key?.startsWith("uuse-need-draft:" + personId + ":") ||
        key?.startsWith("uuse-message-draft:" + personId + ":")
      )
        keys.push(key);
    }
  } catch {
    cleared = false;
  }
  for (const key of keys) {
    try {
      storage.removeItem(key);
    } catch {
      cleared = false;
    }
  }
  return cleared;
}
