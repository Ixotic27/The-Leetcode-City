export function parseDeveloperId(rawDeveloperId: string): number | null {
  if (!/^\d+$/.test(rawDeveloperId)) {
    return null;
  }

  const developerId = Number.parseInt(rawDeveloperId, 10);
  if (!Number.isSafeInteger(developerId) || developerId < 1) {
    return null;
  }

  return developerId;
}
