function toValue(v) {
  if (v === null || v === undefined) return { nullValue: "NULL_VALUE" };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") {
    return Number.isInteger(v)
      ? { integerValue: String(v) }
      : { doubleValue: v };
  }
  if (Array.isArray(v)) {
    return { arrayValue: { values: v.map(toValue) } };
  }
  if (typeof v === "object") {
    const fields = {};
    for (const [k, val] of Object.entries(v)) fields[k] = toValue(val);
    return { mapValue: { fields } };
  }
  return { stringValue: String(v) };
}

function fromValue(v) {
  if (!v) return null;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return Number(v.integerValue);
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.nullValue !== undefined) return null;
  if (v.timestampValue !== undefined) return v.timestampValue;
  if (v.arrayValue) return (v.arrayValue.values || []).map(fromValue);
  if (v.mapValue) {
    const o = {};
    for (const [k, val] of Object.entries(v.mapValue.fields || {})) {
      o[k] = fromValue(val);
    }
    return o;
  }
  return null;
}

export function dbToFields(db) {
  const fields = {};
  for (const [k, v] of Object.entries(db)) fields[k] = toValue(v);
  return fields;
}

export function fieldsToDb(fields) {
  const db = {};
  for (const [k, v] of Object.entries(fields || {})) db[k] = fromValue(v);
  return db;
}
