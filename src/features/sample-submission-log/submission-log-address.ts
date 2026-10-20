export interface RequesterAddress {
  detail: string;
  province: string;
  district: string;
  subdistrict: string;
  zipcode: string;
}

export function parseRequesterAddress(value: string): RequesterAddress {
  const labelled = value.match(
    /^([\s\S]*)\nจังหวัด: ([^\r\n]*)\nอำเภอ \/ เขต: ([^\r\n]*)\nตำบล \/ แขวง: ([^\r\n]*)\nรหัสไปรษณีย์: ([^\r\n]*)$/u,
  );
  if (labelled)
    return {
      detail: labelled[1],
      province: labelled[2],
      district: labelled[3],
      subdistrict: labelled[4],
      zipcode: labelled[5],
    };
  // Only split unambiguous legacy addresses; unknown text stays intact in detail.
  const legacy = value.match(
    /^([\s\S]*?)\s+(?:ต\.|ตำบล|แขวง)\s*(.+?)\s+(?:อ\.|อำเภอ|เขต)\s*(.+?)\s+(?:จ\.|จังหวัด)\s*(.+?)\s+(\d{5})$/u,
  );
  if (legacy)
    return {
      detail: legacy[1],
      province: legacy[4],
      district: legacy[3],
      subdistrict: legacy[2],
      zipcode: legacy[5],
    };
  return {
    detail: value,
    province: "",
    district: "",
    subdistrict: "",
    zipcode: "",
  };
}

export function composeRequesterAddress(address: RequesterAddress): string {
  const { detail, province, district, subdistrict, zipcode } = address;
  if (![province, district, subdistrict, zipcode].some((v) => v !== ""))
    return detail;
  return `${detail}\nจังหวัด: ${province}\nอำเภอ / เขต: ${district}\nตำบล / แขวง: ${subdistrict}\nรหัสไปรษณีย์: ${zipcode}`;
}

export function editRequesterAddress(
  value: string,
  key: keyof RequesterAddress,
  next: string,
): string {
  const address = parseRequesterAddress(value);
  if (address[key] === next) return value;
  if (key === "province") {
    address.district = "";
    address.subdistrict = "";
    address.zipcode = "";
  }
  if (key === "district") {
    address.subdistrict = "";
    address.zipcode = "";
  }
  if (key === "subdistrict") address.zipcode = "";
  address[key] = next;
  return composeRequesterAddress(address);
}
