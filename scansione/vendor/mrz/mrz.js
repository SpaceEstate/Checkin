// lib/formats.js
var formats = {
  TD1: "TD1",
  TD2: "TD2",
  TD3: "TD3",
  SWISS_DRIVING_LICENSE: "SWISS_DRIVING_LICENSE",
  FRENCH_NATIONAL_ID: "FRENCH_NATIONAL_ID",
  FRENCH_DRIVING_LICENSE: "FRENCH_DRIVING_LICENSE"
};

// lib/generated/states.js
var states = {
  "AFG": "Afghanistan",
  "ALB": "Albania",
  "DZA": "Algeria",
  "ASM": "American Samoa",
  "AND": "Andorra",
  "AGO": "Angola",
  "AIA": "Anguilla",
  "ATA": "Antarctica",
  "ATG": "Antigua and Barbuda",
  "ARG": "Argentina",
  "ARM": "Armenia",
  "ABW": "Aruba",
  "AUS": "Australia",
  "AUT": "Austria",
  "AZE": "Azerbaijan",
  "BHS": "Bahamas (the)",
  "BHR": "Bahrain",
  "BGD": "Bangladesh",
  "BRB": "Barbados",
  "BLR": "Belarus",
  "BEL": "Belgium",
  "BLZ": "Belize",
  "BEN": "Benin",
  "BMU": "Bermuda",
  "BTN": "Bhutan",
  "BOL": "Bolivia (Plurinational State of)",
  "BES": "Bonaire, Sint Eustatius and Saba",
  "BIH": "Bosnia and Herzegovina",
  "BWA": "Botswana",
  "BVT": "Bouvet Island",
  "BRA": "Brazil",
  "IOT": "British Indian Ocean Territory (the)",
  "BRN": "Brunei Darussalam",
  "BGR": "Bulgaria",
  "BFA": "Burkina Faso",
  "BDI": "Burundi",
  "CPV": "Cabo Verde",
  "KHM": "Cambodia",
  "CMR": "Cameroon",
  "CAN": "Canada",
  "CYM": "Cayman Islands (the)",
  "CAF": "Central African Republic (the)",
  "TCD": "Chad",
  "CHL": "Chile",
  "CHN": "China",
  "CXR": "Christmas Island",
  "CCK": "Cocos (Keeling) Islands (the)",
  "COL": "Colombia",
  "COM": "Comoros (the)",
  "COD": "Congo (the Democratic Republic of the)",
  "COG": "Congo (the)",
  "COK": "Cook Islands (the)",
  "CRI": "Costa Rica",
  "HRV": "Croatia",
  "CUB": "Cuba",
  "CUW": "Cura\xE7ao",
  "CYP": "Cyprus",
  "CZE": "Czechia",
  "CIV": "C\xF4te d'Ivoire",
  "DNK": "Denmark",
  "DJI": "Djibouti",
  "DMA": "Dominica",
  "DOM": "Dominican Republic (the)",
  "ECU": "Ecuador",
  "EGY": "Egypt",
  "SLV": "El Salvador",
  "GNQ": "Equatorial Guinea",
  "ERI": "Eritrea",
  "EST": "Estonia",
  "SWZ": "Eswatini",
  "ETH": "Ethiopia",
  "FLK": "Falkland Islands (the) [Malvinas]",
  "FRO": "Faroe Islands (the)",
  "FJI": "Fiji",
  "FIN": "Finland",
  "FRA": "France",
  "GUF": "French Guiana",
  "PYF": "French Polynesia",
  "ATF": "French Southern Territories (the)",
  "GAB": "Gabon",
  "GMB": "Gambia (the)",
  "GEO": "Georgia",
  "DEU": "Germany",
  "GHA": "Ghana",
  "GIB": "Gibraltar",
  "GRC": "Greece",
  "GRL": "Greenland",
  "GRD": "Grenada",
  "GLP": "Guadeloupe",
  "GUM": "Guam",
  "GTM": "Guatemala",
  "GGY": "Guernsey",
  "GIN": "Guinea",
  "GNB": "Guinea-Bissau",
  "GUY": "Guyana",
  "HTI": "Haiti",
  "HMD": "Heard Island and McDonald Islands",
  "VAT": "Holy See (the)",
  "HND": "Honduras",
  "HKG": "Hong Kong",
  "HUN": "Hungary",
  "ISL": "Iceland",
  "IND": "India",
  "IDN": "Indonesia",
  "IRN": "Iran (Islamic Republic of)",
  "IRQ": "Iraq",
  "IRL": "Ireland",
  "IMN": "Isle of Man",
  "ISR": "Israel",
  "ITA": "Italy",
  "JAM": "Jamaica",
  "JPN": "Japan",
  "JEY": "Jersey",
  "JOR": "Jordan",
  "KAZ": "Kazakhstan",
  "KEN": "Kenya",
  "KIR": "Kiribati",
  "PRK": "Korea (the Democratic People's Republic of)",
  "KOR": "Korea (the Republic of)",
  "KWT": "Kuwait",
  "KGZ": "Kyrgyzstan",
  "LAO": "Lao People's Democratic Republic (the)",
  "LVA": "Latvia",
  "LBN": "Lebanon",
  "LSO": "Lesotho",
  "LBR": "Liberia",
  "LBY": "Libya",
  "LIE": "Liechtenstein",
  "LTU": "Lithuania",
  "LUX": "Luxembourg",
  "MAC": "Macao",
  "MDG": "Madagascar",
  "MWI": "Malawi",
  "MYS": "Malaysia",
  "MDV": "Maldives",
  "MLI": "Mali",
  "MLT": "Malta",
  "MHL": "Marshall Islands (the)",
  "MTQ": "Martinique",
  "MRT": "Mauritania",
  "MUS": "Mauritius",
  "MYT": "Mayotte",
  "MEX": "Mexico",
  "FSM": "Micronesia (Federated States of)",
  "MDA": "Moldova (the Republic of)",
  "MCO": "Monaco",
  "MNG": "Mongolia",
  "MNE": "Montenegro",
  "MSR": "Montserrat",
  "MAR": "Morocco",
  "MOZ": "Mozambique",
  "MMR": "Myanmar",
  "NAM": "Namibia",
  "NRU": "Nauru",
  "NPL": "Nepal",
  "NLD": "Netherlands (the)",
  "NCL": "New Caledonia",
  "NZL": "New Zealand",
  "NIC": "Nicaragua",
  "NER": "Niger (the)",
  "NGA": "Nigeria",
  "NIU": "Niue",
  "NFK": "Norfolk Island",
  "MKD": "North Macedonia",
  "MNP": "Northern Mariana Islands (the)",
  "NOR": "Norway",
  "OMN": "Oman",
  "PAK": "Pakistan",
  "PLW": "Palau",
  "PSE": "Palestine, State of",
  "PAN": "Panama",
  "PNG": "Papua New Guinea",
  "PRY": "Paraguay",
  "PER": "Peru",
  "PHL": "Philippines (the)",
  "PCN": "Pitcairn",
  "POL": "Poland",
  "PRT": "Portugal",
  "PRI": "Puerto Rico",
  "QAT": "Qatar",
  "ROU": "Romania",
  "RUS": "Russian Federation (the)",
  "RWA": "Rwanda",
  "REU": "R\xE9union",
  "BLM": "Saint Barth\xE9lemy",
  "SHN": "Saint Helena, Ascension and Tristan da Cunha",
  "KNA": "Saint Kitts and Nevis",
  "LCA": "Saint Lucia",
  "MAF": "Saint Martin (French part)",
  "SPM": "Saint Pierre and Miquelon",
  "VCT": "Saint Vincent and the Grenadines",
  "WSM": "Samoa",
  "SMR": "San Marino",
  "STP": "Sao Tome and Principe",
  "SAU": "Saudi Arabia",
  "SEN": "Senegal",
  "SRB": "Serbia",
  "SYC": "Seychelles",
  "SLE": "Sierra Leone",
  "SGP": "Singapore",
  "SXM": "Sint Maarten (Dutch part)",
  "SVK": "Slovakia",
  "SVN": "Slovenia",
  "SLB": "Solomon Islands",
  "SOM": "Somalia",
  "ZAF": "South Africa",
  "SGS": "South Georgia and the South Sandwich Islands",
  "SSD": "South Sudan",
  "ESP": "Spain",
  "LKA": "Sri Lanka",
  "SDN": "Sudan (the)",
  "SUR": "Suriname",
  "SJM": "Svalbard and Jan Mayen",
  "SWE": "Sweden",
  "CHE": "Switzerland",
  "SYR": "Syrian Arab Republic (the)",
  "TWN": "Taiwan (Province of China)",
  "TJK": "Tajikistan",
  "TZA": "Tanzania, the United Republic of",
  "THA": "Thailand",
  "TLS": "Timor-Leste",
  "TGO": "Togo",
  "TKL": "Tokelau",
  "TON": "Tonga",
  "TTO": "Trinidad and Tobago",
  "TUN": "Tunisia",
  "TUR": "Turkey",
  "TKM": "Turkmenistan",
  "TCA": "Turks and Caicos Islands (the)",
  "TUV": "Tuvalu",
  "UGA": "Uganda",
  "UKR": "Ukraine",
  "ARE": "United Arab Emirates (the)",
  "GBR": "United Kingdom of Great Britain and Northern Ireland (the)",
  "UMI": "United States Minor Outlying Islands (the)",
  "USA": "United States of America (the)",
  "URY": "Uruguay",
  "UZB": "Uzbekistan",
  "VUT": "Vanuatu",
  "VEN": "Venezuela (Bolivarian Republic of)",
  "VNM": "Viet Nam",
  "VGB": "Virgin Islands (British)",
  "VIR": "Virgin Islands (U.S.)",
  "WLF": "Wallis and Futuna",
  "ESH": "Western Sahara*",
  "YEM": "Yemen",
  "ZMB": "Zambia",
  "ZWE": "Zimbabwe",
  "ALA": "\xC5land Islands",
  "GBD": "British Overseas Territories Citizen",
  "GBN": "British National (Overseas)",
  "GBO": "British Overseas Citizen",
  "GBS": "British Subject",
  "GBP": "British Protected Person",
  "RKS": "Republic of Kosovo",
  "D": "Germany",
  "XXK": "Kosovo",
  "EUE": "European Union (EU)",
  "UNO": "United Nations Organization or one of its officials",
  "UNA": "United Nations specialized agency or one of its officials",
  "UNK": "Resident of Kosovo to whom a travel document has been issued by the United Nations Interim Administration Mission in Kosovo (UNMIK)",
  "XBA": "African Development Bank (ADB)",
  "XIM": "African Export-Import Bank (AFREXIM bank)",
  "XCC": "Caribbean Community or one of its emissaries (CARICOM)",
  "XCE": "Council of Europe",
  "XCO": "Common Market for Eastern and Southern Africa (COMESA)",
  "XEC": "Economic Community of West African States (ECOWAS)",
  "XPO": "International Criminal Police Organization (INTERPOL)",
  "XES": "Organization of Eastern Caribbean States (OECS)",
  "XOM": "Sovereign Military Order of Malta or one of its emissaries",
  "XDC": "Southern African Development Community",
  "XXA": "Stateless person, as defined in Article 1 of the 1954 Convention Relating to the Status of Stateless Persons",
  "XXB": "Refugee, as defined in Article 1 of the 1951 Convention Relating to the Status of Refugees as amended by the 1967 Protocol",
  "XXC": "Refugee, other than as defined under the code XXB above",
  "XXX": "Person of unspecified nationality, for whom issuing State does not consider it necessary to specify any of the codes XXA, XXB or XXC above, whatever that person\u2019s status may be. This category may include a person who is neither stateless nor a refugee but who is of unknown nationality and legally residing in the State of issue.",
  "ANT": "Netherlands Antilles",
  "NTZ": "Neutral Zone"
};
Object.freeze(states);
var states_default = states;

// lib/parse/checkLines.js
function checkLines(lines) {
  if (typeof lines === "string") {
    lines = lines.split(/[\r\n]+/);
  }
  if (!Array.isArray(lines)) {
    throw new TypeError("input must be an array or string");
  }
  for (const line of lines) {
    if (!line.match(/[A-Z0-9<]+/)) {
      throw new TypeError('lines must be composed of only alphanumerical characters and "<"');
    }
  }
  return lines;
}

// lib/parsers/frenchDrivingLicence/parseDocumentCode.js
var knownPrefixCode = ["A", "B", "D"];
function parseDocumentCode(source) {
  if (source.length !== 2) {
    throw new Error(`invalid document code: ${source}. must be 2 char length`);
  }
  const [first, second] = source;
  validateFirstChar(first, source);
  validateSecondChar(second, source);
  return `${first}${second}`;
}
function validateFirstChar(char, source) {
  if (!knownPrefixCode.includes(char)) {
    const formatter = new Intl.ListFormat("en-US", {
      style: "short",
      type: "disjunction"
    });
    throw new Error(`invalid document code: ${source}. First character must be ${formatter.format(knownPrefixCode)}`);
  }
}
function validateSecondChar(char, source) {
  const num = Number.parseInt(char, 10);
  if (Number.isNaN(num)) {
    throw new Error(`invalid document code number: ${source}. Second character must be a number`);
  }
}

// lib/parsers/cleanText.js
function cleanText(string) {
  return string.replaceAll(/<+$/g, "").replaceAll("<", " ");
}

// lib/parsers/parseAlpha.js
function parseAlpha(source) {
  if (!source.match(/^[A-Z<]+$/)) {
    throw new Error(`invalid text: ${source}. Must be only alphabetical with <`);
  }
  return cleanText(source);
}

// lib/parsers/parseText.js
function parseText(source, initialStart, regexp = /^[0-9A-Z<]+$/) {
  const cleaned = cleanText(source);
  if (!regexp.test(source)) {
    throw new ParseTextError(`invalid text: ${source}. Must match the following regular expression: ${regexp.toString()}`, cleaned, initialStart, initialStart + cleaned.length);
  }
  return cleaned;
}
var ParseTextError = class extends Error {
  value;
  start;
  end;
  constructor(message, value, start, end) {
    super(message);
    this.value = value;
    this.start = start;
    this.end = end;
  }
};

// lib/parse/autoCorrection.js
var numberToLetterMismatches = {
  "8": "B",
  "6": "G",
  "0": "O",
  "1": "I",
  "5": "S",
  "2": "Z"
};
var letterToNumberMismatches = {
  B: "8",
  G: "6",
  O: "0",
  I: "1",
  S: "5",
  Z: "2"
};
function letterToNumber(char) {
  if (letterToNumberMismatches[char]) {
    return letterToNumberMismatches[char];
  }
  return char;
}
function numberToLetter(char) {
  if (numberToLetterMismatches[char]) {
    return numberToLetterMismatches[char];
  }
  return char;
}
function autoCorrection(source, fieldOptions) {
  let correctedText = "";
  const autocorrect = [];
  const chars = source.split("");
  for (const [i, char] of chars.entries()) {
    if (fieldOptions.type === fieldTypes.ALPHABETIC) {
      const correctedChar = numberToLetter(char);
      if (correctedChar !== char) {
        autocorrect.push({
          line: fieldOptions.line,
          column: fieldOptions.start + i,
          original: char,
          corrected: correctedChar
        });
      }
      correctedText += correctedChar;
    } else if (fieldOptions.type === fieldTypes.NUMERIC) {
      const correctedChar = letterToNumber(char);
      if (correctedChar !== char) {
        autocorrect.push({
          line: fieldOptions.line,
          column: fieldOptions.start + i,
          original: char,
          corrected: correctedChar
        });
      }
      correctedText += correctedChar;
    } else {
      correctedText += char;
    }
  }
  return { correctedText, autocorrect };
}

// lib/parse/createFieldParser.js
var fieldTypes = {
  NUMERIC: "NUMERIC",
  ALPHABETIC: "ALPHABETIC",
  ALPHANUMERIC: "ALPHANUMERIC"
};
function createFieldParser(fieldOptions) {
  checkType(fieldOptions, "label", "string");
  if (fieldOptions.field !== null) {
    checkType(fieldOptions, "field", "string");
  }
  checkType(fieldOptions, "line", "number");
  checkType(fieldOptions, "start", "number");
  checkType(fieldOptions, "end", "number");
  checkType(fieldOptions, "parser", "function");
  const mainRange = {
    line: fieldOptions.line,
    start: fieldOptions.start,
    end: fieldOptions.end
  };
  const ranges = [mainRange];
  if (Array.isArray(fieldOptions.related)) {
    for (const related of fieldOptions.related) {
      checkType(related, "line", "number");
      checkType(related, "start", "number");
      checkType(related, "end", "number");
      ranges.push(related);
    }
  }
  const parser = (lines, autocorrect) => {
    const source = getText(lines, fieldOptions);
    const related = fieldOptions.related || [];
    const textRelated = related.map((r) => getText(lines, r));
    const result = {
      label: fieldOptions.label,
      field: fieldOptions.field,
      value: null,
      valid: false,
      ranges: ranges.map((range2) => ({
        ...range2,
        raw: getText(lines, range2)
      })),
      line: 0,
      start: 0,
      end: 0,
      autocorrect: []
    };
    const range = result.ranges[0];
    result.line = range.line;
    result.start = range.start;
    result.end = range.end;
    try {
      const parsed = fieldOptions.parser(source, ...textRelated);
      if (typeof parsed === "object") {
        result.value = parsed.value;
        result.valid = parsed.valid ?? true;
        if (parsed.start !== void 0) {
          result.start = range.start + parsed.start;
        }
        if (parsed.end !== void 0) {
          result.end = range.start + parsed.end;
        }
        if (parsed.valid === false && parsed.error) {
          result.error = parsed.error;
        }
      } else {
        result.value = parsed;
        result.valid = true;
      }
    } catch (error) {
      result.error = error.message;
      if (error instanceof ParseTextError) {
        result.value = error.value;
        result.start = range.start + error.start;
        result.end = range.start + error.end;
      }
    }
    for (const autocorrectElement of autocorrect) {
      if (autocorrectElement.line === result.line && autocorrectElement.column >= result.start && autocorrectElement.column < result.end) {
        result.autocorrect.push(autocorrectElement);
      }
    }
    return result;
  };
  const autocorrector = (lines) => {
    const originalText = getText(lines, fieldOptions);
    return {
      ...autoCorrection(originalText, fieldOptions),
      range: mainRange
    };
  };
  return { parser, autocorrector };
}
function getText(lines, options) {
  const line = lines[options.line];
  return line.slice(options.start, options.end);
}
function checkType(options, name, type) {
  if (typeof options[name] !== type) {
    throw new TypeError(`${String(name)} must be a ${type}`);
  }
}

// lib/parsers/check.js
function computeCheckDigit(string) {
  let code = 0;
  const factors = [7, 3, 1];
  for (let i = 0; i < string.length; i++) {
    let charCode = string.charCodeAt(i);
    if (charCode === 60)
      charCode = 0;
    if (charCode >= 65)
      charCode -= 55;
    if (charCode >= 48)
      charCode -= 48;
    charCode *= factors[i % 3];
    code += charCode;
  }
  return code % 10;
}
function check(string, input) {
  const code = computeCheckDigit(string);
  const valid = code === Number(input);
  return {
    valid,
    error: valid ? null : `invalid check digit: ${input}. Must be ${code}`
  };
}

// lib/parsers/parseCompositeCheckDigit.js
function parseCompositeCheckDigit(checkDigit, ...sources) {
  const source = sources.join("");
  const checkResult = check(source, checkDigit);
  return {
    value: checkDigit,
    ...checkResult
  };
}

// lib/parsers/parseDate.js
function parseDate(value) {
  if (!value.match(/^[0-9<]{4,6}$/)) {
    throw new Error(`invalid date: ${value}`);
  }
  const month = value.slice(2, 4);
  if (month !== "<<" && (Number.parseInt(month, 10) < 1 || Number.parseInt(month, 10) > 12)) {
    throw new Error(`invalid date month: ${month}`);
  }
  if (value.length === 6) {
    const day = value.slice(4, 6);
    if (day !== "<<" && (Number.parseInt(day, 10) < 1 || Number.parseInt(day, 10) > 31)) {
      throw new Error(`invalid date day: ${day}`);
    }
  }
  return value;
}

// lib/parsers/parseDateCheckDigit.js
function parseCheckDigit(checkDigit, value) {
  return {
    value: checkDigit,
    ...check(value, checkDigit)
  };
}

// lib/parsers/parseDocumentNumber.js
function parseDocumentNumber(source, checkDigit, optional) {
  let end, value;
  if (checkDigit === "<" && optional) {
    const firstFiller = optional.indexOf("<");
    const tail = optional.slice(0, firstFiller - 1);
    value = source + tail;
    end = value.length + 1;
  } else {
    value = cleanText(source);
    end = value.length;
  }
  return {
    value,
    start: 0,
    end
  };
}

// lib/parsers/parseDocumentNumberCheckDigit.js
function parseDocumentNumberCheckDigit(checkDigit, source, optional) {
  if (checkDigit === "<" && optional) {
    const firstFiller = optional.indexOf("<");
    const tail = optional.slice(0, firstFiller - 1);
    const embeddedDigit = optional.charAt(firstFiller - 1);
    const result = {
      value: embeddedDigit,
      start: firstFiller,
      end: firstFiller + 1
    };
    let checkDigit2 = check(`${source}<${tail}`, embeddedDigit);
    if (checkDigit2.valid) {
      return {
        ...result,
        ...checkDigit2
      };
    }
    checkDigit2 = check(`${source}${tail}`, embeddedDigit);
    return {
      ...result,
      ...checkDigit2
    };
  } else {
    return {
      value: checkDigit,
      ...check(source, checkDigit)
    };
  }
}

// lib/parsers/parseFirstName.js
function parseFirstName(source) {
  const withoutStart = source.replace(/.*?<{2}/, "");
  const value = parseText(withoutStart, source.length - withoutStart.length, /^[A-Z<]+<*$/);
  const start = source.length - withoutStart.length;
  return {
    value,
    start,
    end: start + value.length
  };
}

// lib/parsers/parseLastName.js
function parseLastName(source) {
  const parsed = parseText(source.replace(/<{2}.*$/, ""), 0, /^[A-Z<]*<*$/);
  return {
    value: parsed,
    start: 0,
    end: parsed.length
  };
}

// lib/parsers/parseSex.js
function parseSex(source) {
  switch (source) {
    case "M":
      return "male";
    case "F":
      return "female";
    case "<":
      return "nonspecified";
    default:
      throw new Error(`invalid sex: ${source}. Must be M, F or <.`);
  }
}

// lib/parsers/parseState.js
function parseState(source) {
  source = cleanText(source);
  const state = states_default[source];
  if (!state) {
    throw new Error(`invalid state code: ${source}`);
  }
  return {
    value: source,
    start: 0,
    end: source.length
  };
}

// lib/parse/fieldTemplates.js
var documentNumberTemplate = {
  label: "Document number",
  field: "documentNumber",
  parser: parseDocumentNumber,
  type: fieldTypes.ALPHANUMERIC
};
var documentNumberCheckDigitTemplate = {
  label: "Document number check digit",
  field: "documentNumberCheckDigit",
  parser: parseDocumentNumberCheckDigit,
  type: fieldTypes.NUMERIC
};
var documentCodeTemplate = {
  label: "Document code",
  field: "documentCode",
  type: fieldTypes.ALPHABETIC
};
var documentCodeAlphaNumTemplate = {
  label: "Document code",
  field: "documentCode",
  type: fieldTypes.ALPHANUMERIC
};
var nationalityTemplate = {
  label: "Nationality",
  field: "nationality",
  parser: parseState,
  type: fieldTypes.ALPHABETIC
};
var sexTemplate = {
  label: "Sex",
  field: "sex",
  parser: parseSex,
  type: fieldTypes.ALPHABETIC
};
var expirationDateTemplate = {
  label: "Expiration date",
  field: "expirationDate",
  parser: parseDate,
  type: fieldTypes.NUMERIC
};
var expirationDateCheckDigitTemplate = {
  label: "Expiration date check digit",
  field: "expirationDateCheckDigit",
  parser: parseCheckDigit,
  type: fieldTypes.NUMERIC
};
var compositeCheckDigitTemplate = {
  label: "Composite check digit",
  field: "compositeCheckDigit",
  parser: parseCompositeCheckDigit,
  type: fieldTypes.NUMERIC
};
var birthDateTemplate = {
  label: "Birth date",
  field: "birthDate",
  parser: parseDate,
  type: fieldTypes.NUMERIC
};
var birthDateCheckDigitTemplate = {
  label: "Birth date check digit",
  field: "birthDateCheckDigit",
  parser: parseCheckDigit,
  type: fieldTypes.NUMERIC
};
var issueDateTemplate = {
  label: "Issue date",
  field: "issueDate",
  parser: parseDate,
  type: fieldTypes.NUMERIC
};
var firstNameTemplate = {
  label: "First name",
  field: "firstName",
  parser: parseFirstName,
  type: fieldTypes.ALPHABETIC
};
var lastNameTemplate = {
  label: "Last name",
  field: "lastName",
  parser: parseLastName,
  type: fieldTypes.ALPHABETIC
};
var issuingStateTemplate = {
  label: "Issuing state",
  field: "issuingState",
  parser: parseState,
  type: fieldTypes.ALPHABETIC
};

// lib/parse/frenchDrivingLicenceFields.js
var fields = [
  {
    ...documentCodeAlphaNumTemplate,
    line: 0,
    start: 0,
    end: 2,
    parser: parseDocumentCode
  },
  { ...issuingStateTemplate, line: 0, start: 2, end: 5 },
  { ...documentNumberTemplate, line: 0, start: 5, end: 14 },
  {
    ...documentNumberCheckDigitTemplate,
    line: 0,
    start: 14,
    end: 15,
    related: [
      {
        line: 0,
        start: 0,
        end: 14
      }
    ]
  },
  { ...expirationDateTemplate, line: 0, start: 15, end: 21 },
  { ...lastNameTemplate, line: 0, start: 21, end: 29, parser: parseAlpha },
  {
    ...compositeCheckDigitTemplate,
    line: 0,
    start: 29,
    end: 30,
    related: [
      {
        line: 0,
        start: 0,
        end: 29
      }
    ]
  }
];
var frenchDrivingLicenceFields_default = fields.map(createFieldParser);

// lib/parse/getDocumentNumber.js
function getDocumentNumber(format, fields7) {
  switch (format) {
    case "TD1":
    case "TD2":
    case "TD3":
    case "FRENCH_DRIVING_LICENSE":
      return buildDocumentNumber(fields7.documentNumber);
    case "FRENCH_NATIONAL_ID":
      return buildDocumentNumber(fields7.issueDate, fields7.administrativeCode2, fields7.documentNumber);
    case "SWISS_DRIVING_LICENSE":
      return buildDocumentNumber(fields7.pinCode, fields7.versionNumber);
    default:
      assertUnreachableFormat(format);
  }
}
function buildDocumentNumber(...parts) {
  let result = "";
  for (const part of parts) {
    if (!part) {
      return null;
    }
    result += part;
  }
  return result;
}
function assertUnreachableFormat(format) {
  throw new Error(`unrecognized format: ${format}`);
}

// lib/parse/getResult.js
function getDetails(lines, fieldParsers, autocorrectArray) {
  const details = [];
  for (const [i, { parser }] of fieldParsers.entries()) {
    details.push(parser(lines, autocorrectArray[i]));
  }
  return details;
}
function getFields(details) {
  const fields7 = {};
  let allValid = true;
  for (const detail of details) {
    if (!detail.valid) {
      allValid = false;
    }
    if (detail.field) {
      fields7[detail.field] = detail.valid ? detail.value : null;
    }
  }
  return { fields: fields7, allValid };
}
function getCorrection(lines, fieldParsers, autocorrect) {
  const corrected = lines.slice();
  let autocorrectArray = [];
  if (autocorrect) {
    for (const { autocorrector } of fieldParsers) {
      const { autocorrect: autocorrect2, correctedText, range } = autocorrector(lines);
      autocorrectArray.push(autocorrect2);
      const line = corrected[range.line];
      corrected[range.line] = line.slice(0, range.start) + correctedText + line.slice(range.end);
    }
  } else {
    autocorrectArray = new Array(fieldParsers.length).fill([]);
  }
  return { corrected, autocorrectArray };
}
function getResult(format, lines, fieldParsers, options) {
  const { autocorrect = false } = options;
  const { corrected, autocorrectArray } = getCorrection(lines, fieldParsers, autocorrect);
  const details = getDetails(corrected, fieldParsers, autocorrectArray);
  const fields7 = getFields(details);
  return {
    format,
    details,
    fields: fields7.fields,
    documentNumber: getDocumentNumber(format, fields7.fields),
    valid: fields7.allValid
  };
}

// lib/parse/frenchDrivingLicence.js
var FRENCH_DRIVING_LICENSE = formats.FRENCH_DRIVING_LICENSE;
function parseFrenchDrivingLicense(lines, options) {
  if (lines.length !== 1) {
    throw new Error(`invalid number of lines: ${lines.length}: Must be 1 for ${FRENCH_DRIVING_LICENSE}`);
  }
  if (lines[0].length !== 30) {
    throw new Error(`invalid number of characters for line 1: ${lines[0].length}. Must be 30 for ${FRENCH_DRIVING_LICENSE}`);
  }
  return getResult(FRENCH_DRIVING_LICENSE, lines, frenchDrivingLicenceFields_default, options);
}

// lib/parsers/parseDocumentCodeId.js
function parseDocumentCodeId(source) {
  const first = source.charAt(0);
  if (first !== "A" && first !== "C" && first !== "I") {
    throw new Error(`invalid document code: ${source}. First character must be A, C or I`);
  }
  const second = source.charAt(1);
  if (second === "V") {
    throw new Error(`invalid document code: ${source}. Second character may not be V`);
  }
  if (second === "<") {
    return {
      value: first,
      start: 0,
      end: 1
    };
  } else {
    return source;
  }
}

// lib/parsers/parseOptional.js
function parseOptional(source) {
  const value = parseText(source, 0);
  return {
    value,
    start: 0,
    end: value.length
  };
}

// lib/parse/frenchNationalIdFields.js
var fields2 = [
  {
    ...documentCodeTemplate,
    line: 0,
    start: 0,
    end: 2,
    parser: parseDocumentCodeId
  },
  { ...issuingStateTemplate, line: 0, start: 2, end: 5 },
  { ...lastNameTemplate, line: 0, start: 5, end: 30, parser: parseAlpha },
  {
    label: "Administrative code",
    field: "administrativeCode",
    line: 0,
    start: 30,
    end: 36,
    parser: parseOptional
  },
  { ...issueDateTemplate, line: 1, start: 0, end: 4 },
  {
    label: "Administrative code 2",
    field: "administrativeCode2",
    line: 1,
    start: 4,
    end: 7,
    parser: parseOptional
  },
  { ...documentNumberTemplate, line: 1, start: 7, end: 12 },
  {
    ...documentNumberCheckDigitTemplate,
    line: 1,
    start: 12,
    end: 13,
    related: [
      {
        line: 1,
        start: 0,
        end: 12
      }
    ]
  },
  { ...firstNameTemplate, line: 1, start: 13, end: 27, parser: parseAlpha },
  { ...birthDateTemplate, line: 1, start: 27, end: 33 },
  {
    ...birthDateCheckDigitTemplate,
    line: 1,
    start: 33,
    end: 34,
    related: [
      {
        line: 1,
        start: 27,
        end: 33
      }
    ]
  },
  { ...sexTemplate, line: 1, start: 34, end: 35 },
  {
    ...compositeCheckDigitTemplate,
    line: 1,
    start: 35,
    end: 36,
    related: [
      {
        line: 0,
        start: 0,
        end: 36
      },
      {
        line: 1,
        start: 0,
        end: 35
      }
    ]
  }
];
var frenchNationalIdFields_default = fields2.map(createFieldParser);

// lib/parse/frenchNationalId.js
var FRENCH_NATIONAL_ID = formats.FRENCH_NATIONAL_ID;
function parseFrenchNationalId(lines, options) {
  if (lines.length !== 2) {
    throw new Error(`invalid number of lines: ${lines.length}: Must be 2 for ${FRENCH_NATIONAL_ID}`);
  }
  for (const [index, line] of lines.entries()) {
    if (line.length !== 36) {
      throw new Error(`invalid number of characters for line ${index + 1}: ${line.length}. Must be 36 for ${FRENCH_NATIONAL_ID}`);
    }
  }
  return getResult(FRENCH_NATIONAL_ID, lines, frenchNationalIdFields_default, options);
}

// lib/parsers/parseNumber.js
function parseNumber(source) {
  if (!source.match(/^[0-9]+$/)) {
    throw new Error(`invalid number: ${source}`);
  }
  return source;
}

// lib/parsers/swissDrivingLicense/checkSeparator.js
function checkSeparator(source) {
  if (!source.match(/^<*$/)) {
    throw new Error(`invalid separator: ${source}. Must be composed only of "<"`);
  }
  return source;
}

// lib/parsers/swissDrivingLicense/parseDocumentCode.js
function parseDocumentCode2(source) {
  if (source !== "FA") {
    throw new Error(`invalid document code: ${source}. Must be FA`);
  }
  return source;
}

// lib/parsers/swissDrivingLicense/parseLanguageCode.js
function parseLanguageCode(languageCode) {
  switch (languageCode) {
    case "D":
    case "F":
    case "I":
    case "R":
      return languageCode;
    default:
      throw new Error(`invalid languageCode code: ${languageCode}. Must be D, F, I or R`);
  }
}

// lib/parsers/swissDrivingLicense/parseDocumentNumber.js
function parseDocumentNumber2(source) {
  const first = source.slice(0, 3);
  const second = source.slice(3, 6);
  const languageCode = source.charAt(6);
  const end = source.slice(7);
  if (!first.match(/^[A-Z0-9]{3}$/)) {
    throw new Error(`invalid document number: ${source}. Must start with three alphanumeric digits`);
  }
  if (!second.match(/^[0-9]{3}$/)) {
    throw new Error(`invalid document number: ${source}. Must have numeric digits in positions 4, 5 and 6`);
  }
  if (end !== "<<") {
    throw new Error(`invalid document number: ${source}. Must end with <<`);
  }
  parseLanguageCode(languageCode);
  return {
    value: source.slice(0, 7),
    start: 0,
    end: 7
  };
}

// lib/parsers/swissDrivingLicense/parseIssuingState.js
function parseIssuingState(source) {
  if (source !== "CHE" && source !== "LIE") {
    throw new Error(`invalid state code: ${source}. Must be CHE or LIE`);
  }
  return source;
}

// lib/parse/swissDrivingLicenseFields.js
var fields3 = [
  {
    ...documentNumberTemplate,
    line: 0,
    start: 0,
    end: 9,
    parser: parseDocumentNumber2
  },
  {
    label: "Language code",
    field: "languageCode",
    line: 0,
    start: 6,
    end: 7,
    parser: parseLanguageCode,
    type: fieldTypes.ALPHABETIC
  },
  {
    ...documentCodeTemplate,
    line: 1,
    start: 0,
    end: 2,
    parser: parseDocumentCode2
  },
  {
    ...issuingStateTemplate,
    line: 1,
    start: 2,
    end: 5,
    parser: parseIssuingState
  },
  {
    label: "PIN code",
    field: "pinCode",
    line: 1,
    start: 5,
    end: 14,
    parser: parseNumber,
    type: fieldTypes.NUMERIC
  },
  {
    label: "Version number",
    field: "versionNumber",
    line: 1,
    start: 14,
    end: 17,
    parser: parseNumber,
    type: fieldTypes.NUMERIC
  },
  {
    label: "Separator 1",
    field: null,
    line: 1,
    start: 17,
    end: 19,
    parser: checkSeparator
  },
  { ...birthDateTemplate, line: 1, start: 19, end: 25 },
  {
    label: "Separator 2",
    field: null,
    line: 1,
    start: 25,
    end: 30,
    parser: checkSeparator
  },
  { ...lastNameTemplate, line: 2, start: 0, end: 30 },
  { ...firstNameTemplate, line: 2, start: 0, end: 30 }
];
var swissDrivingLicenseFields_default = fields3.map(createFieldParser);

// lib/parse/swissDrivingLicense.js
var SWISS_DRIVING_LICENSE = formats.SWISS_DRIVING_LICENSE;
function parseSwissDrivingLicense(lines, options) {
  if (lines.length !== 3) {
    throw new Error(`invalid number of lines: ${lines.length}: Must be 3 for ${SWISS_DRIVING_LICENSE}`);
  }
  if (lines[0].length !== 9) {
    throw new Error(`invalid number of characters for line 1: ${lines[0].length}. Must be 9 for ${SWISS_DRIVING_LICENSE}`);
  }
  if (lines[1].length !== 30) {
    throw new Error(`invalid number of characters for line 2: ${lines[1].length}. Must be 30 for ${SWISS_DRIVING_LICENSE}`);
  }
  if (lines[2].length !== 30) {
    throw new Error(`invalid number of characters for line 3: ${lines[2].length}. Must be 30 for ${SWISS_DRIVING_LICENSE}`);
  }
  return getResult(SWISS_DRIVING_LICENSE, lines, swissDrivingLicenseFields_default, options);
}

// lib/parsers/parseDocumentNumberOptional.js
function parseDocumentNumberOptional(optional) {
  const value = parseText(optional, 0);
  return {
    value,
    start: 0,
    end: value.length
  };
}

// lib/parse/td1Fields.js
var fields4 = [
  {
    ...documentCodeTemplate,
    line: 0,
    start: 0,
    end: 2,
    parser: parseDocumentCodeId
  },
  { ...issuingStateTemplate, line: 0, start: 2, end: 5 },
  {
    ...documentNumberTemplate,
    line: 0,
    start: 5,
    end: 14,
    related: [
      {
        line: 0,
        start: 14,
        end: 15
      },
      {
        line: 0,
        start: 15,
        end: 30
      }
    ]
  },
  {
    ...documentNumberCheckDigitTemplate,
    line: 0,
    start: 14,
    end: 15,
    related: [
      {
        line: 0,
        start: 5,
        end: 14
      },
      {
        line: 0,
        start: 15,
        end: 30
      }
    ]
  },
  {
    label: "Optional field 1",
    field: "optional1",
    line: 0,
    start: 15,
    end: 30,
    related: [],
    parser: parseDocumentNumberOptional
  },
  { ...birthDateTemplate, start: 0, end: 6, line: 1 },
  {
    ...birthDateCheckDigitTemplate,
    line: 1,
    start: 6,
    end: 7,
    related: [
      {
        line: 1,
        start: 0,
        end: 6
      }
    ]
  },
  { ...sexTemplate, line: 1, start: 7, end: 8 },
  { ...expirationDateTemplate, line: 1, start: 8, end: 14 },
  {
    ...expirationDateCheckDigitTemplate,
    line: 1,
    start: 14,
    end: 15,
    related: [
      {
        line: 1,
        start: 8,
        end: 14
      }
    ]
  },
  { ...nationalityTemplate, line: 1, start: 15, end: 18 },
  {
    label: "Optional field 2",
    field: "optional2",
    line: 1,
    start: 18,
    end: 29,
    parser: parseOptional
  },
  {
    ...compositeCheckDigitTemplate,
    line: 1,
    start: 29,
    end: 30,
    related: [
      {
        line: 0,
        start: 5,
        end: 30
      },
      {
        line: 1,
        start: 0,
        end: 7
      },
      {
        line: 1,
        start: 8,
        end: 15
      },
      {
        line: 1,
        start: 18,
        end: 29
      }
    ]
  },
  { ...lastNameTemplate, line: 2, start: 0, end: 30 },
  { ...firstNameTemplate, line: 2, start: 0, end: 30 }
];
var td1Fields_default = fields4.map(createFieldParser);

// lib/parse/td1.js
var TD1 = formats.TD1;
function parseTD1(lines, options) {
  if (lines.length !== 3) {
    throw new Error(`invalid number of lines: ${lines.length}: Must be 3 for ${TD1}`);
  }
  for (const [index, line] of lines.entries()) {
    if (line.length !== 30) {
      throw new Error(`invalid number of characters for line ${index + 1}: ${line.length}. Must be 30 for ${TD1}`);
    }
  }
  return getResult(TD1, lines, td1Fields_default, options);
}

// lib/parse/td2Fields.js
var fields5 = [
  {
    ...documentCodeTemplate,
    line: 0,
    start: 0,
    end: 2,
    parser: parseDocumentCodeId
  },
  { ...issuingStateTemplate, line: 0, start: 2, end: 5 },
  { ...lastNameTemplate, line: 0, start: 5, end: 36 },
  { ...firstNameTemplate, line: 0, start: 5, end: 36 },
  {
    ...documentNumberTemplate,
    line: 1,
    start: 0,
    end: 9,
    related: [
      {
        line: 1,
        start: 9,
        end: 10
      },
      {
        line: 1,
        start: 28,
        end: 35
      }
    ]
  },
  {
    ...documentNumberCheckDigitTemplate,
    line: 1,
    start: 9,
    end: 10,
    related: [
      {
        line: 1,
        start: 0,
        end: 9
      },
      {
        line: 1,
        start: 28,
        end: 35
      }
    ]
  },
  { ...nationalityTemplate, line: 1, start: 10, end: 13 },
  { ...birthDateTemplate, line: 1, start: 13, end: 19 },
  {
    ...birthDateCheckDigitTemplate,
    line: 1,
    start: 19,
    end: 20,
    related: [
      {
        line: 1,
        start: 13,
        end: 19
      }
    ]
  },
  { ...sexTemplate, line: 1, start: 20, end: 21 },
  { ...expirationDateTemplate, line: 1, start: 21, end: 27 },
  {
    ...expirationDateCheckDigitTemplate,
    line: 1,
    start: 27,
    end: 28,
    related: [
      {
        line: 1,
        start: 21,
        end: 27
      }
    ]
  },
  {
    label: "Optional field",
    field: "optional",
    line: 1,
    start: 28,
    end: 35,
    parser: parseOptional
  },
  {
    ...compositeCheckDigitTemplate,
    line: 1,
    start: 35,
    end: 36,
    related: [
      {
        line: 1,
        start: 0,
        end: 10
      },
      {
        line: 1,
        start: 13,
        end: 20
      },
      {
        line: 1,
        start: 21,
        end: 35
      }
    ]
  }
];
var td2Fields_default = fields5.map(createFieldParser);

// lib/parse/td2.js
var TD2 = formats.TD2;
function parseTD2(lines, options) {
  if (lines.length !== 2) {
    throw new Error(`invalid number of lines: ${lines.length}: Must be 2 for ${TD2}`);
  }
  for (const [index, line] of lines.entries()) {
    if (line.length !== 36) {
      throw new Error(`invalid number of characters for line ${index + 1}: ${line.length}. Must be 36 for TD2`);
    }
  }
  return getResult(TD2, lines, td2Fields_default, options);
}

// lib/parsers/parseDocumentCodePassport.js
function parseDocumentCodePassport(source) {
  const first = source.charAt(0);
  if (first !== "P") {
    throw new Error(`invalid document code: ${source}. First character must be P`);
  }
  const second = source.charAt(1);
  if (!second.match(/[A-Z<]/)) {
    throw new Error(`invalid document code: ${source}. Second character must be a letter or <`);
  }
  if (second === "<") {
    return {
      value: first,
      start: 0,
      end: 1
    };
  } else {
    return source;
  }
}

// lib/parsers/parsePersonalNumber.js
function parsePersonalNumber(source) {
  const value = parseText(source, 0, /^[A-Z0-9<]+<*$/);
  return {
    value,
    start: 0,
    end: value.length
  };
}

// lib/parsers/parsePersonalNumberCheckDigit.js
function parsePersonalNumberCheckDigit(checkDigit, personalNumber) {
  const cleanNumber = cleanText(personalNumber);
  if (cleanNumber === "") {
    if (checkDigit !== "<" && checkDigit !== "0") {
      return {
        value: checkDigit,
        valid: false,
        error: `invalid check digit ${checkDigit}: must be 0 or <`
      };
    } else {
      return checkDigit;
    }
  }
  return {
    value: checkDigit,
    ...check(personalNumber, checkDigit)
  };
}

// lib/parse/td3Fields.js
var fields6 = [
  {
    ...documentCodeTemplate,
    line: 0,
    start: 0,
    end: 2,
    parser: parseDocumentCodePassport
  },
  { ...issuingStateTemplate, line: 0, start: 2, end: 5 },
  { ...lastNameTemplate, line: 0, start: 5, end: 44 },
  { ...firstNameTemplate, line: 0, start: 5, end: 44 },
  { ...documentNumberTemplate, line: 1, start: 0, end: 9 },
  {
    ...documentNumberCheckDigitTemplate,
    line: 1,
    start: 9,
    end: 10,
    related: [
      {
        line: 1,
        start: 0,
        end: 9
      }
    ]
  },
  { ...nationalityTemplate, line: 1, start: 10, end: 13 },
  { ...birthDateTemplate, line: 1, start: 13, end: 19 },
  {
    ...birthDateCheckDigitTemplate,
    line: 1,
    start: 19,
    end: 20,
    related: [
      {
        line: 1,
        start: 13,
        end: 19
      }
    ]
  },
  { ...sexTemplate, line: 1, start: 20, end: 21 },
  { ...expirationDateTemplate, line: 1, start: 21, end: 27 },
  {
    ...expirationDateCheckDigitTemplate,
    line: 1,
    start: 27,
    end: 28,
    related: [
      {
        line: 1,
        start: 21,
        end: 27
      }
    ]
  },
  {
    label: "Personal number",
    field: "personalNumber",
    line: 1,
    start: 28,
    end: 42,
    parser: parsePersonalNumber
  },
  {
    label: "Personal number check digit",
    field: "personalNumberCheckDigit",
    line: 1,
    start: 42,
    end: 43,
    related: [
      {
        line: 1,
        start: 28,
        end: 42
      }
    ],
    parser: parsePersonalNumberCheckDigit
  },
  {
    ...compositeCheckDigitTemplate,
    line: 1,
    start: 43,
    end: 44,
    related: [
      {
        line: 1,
        start: 0,
        end: 10
      },
      {
        line: 1,
        start: 13,
        end: 20
      },
      {
        line: 1,
        start: 21,
        end: 43
      }
    ]
  }
];
var td3Fields_default = fields6.map(createFieldParser);

// lib/parse/td3.js
var TD3 = formats.TD3;
function parseTD3(lines, options) {
  if (lines.length !== 2) {
    throw new Error(`invalid number of lines: ${lines.length}: Must be 2 for ${TD3}`);
  }
  for (const [index, line] of lines.entries()) {
    if (line.length !== 44) {
      throw new Error(`invalid number of characters for line ${index + 1}: ${line.length}. Must be 44 for TD3`);
    }
  }
  return getResult(TD3, lines, td3Fields_default, options);
}

// lib/parse/parsers.js
var parsers = {
  td1: parseTD1,
  td2: parseTD2,
  td3: parseTD3,
  swissDrivingLicense: parseSwissDrivingLicense,
  frenchNationalId: parseFrenchNationalId,
  frenchDrivingLicense: parseFrenchDrivingLicense
};

// lib/parse/parse.js
function parseMRZ(inputLines, options = {}) {
  const lines = checkLines(inputLines);
  switch (lines.length) {
    case 1: {
      switch (lines[0].length) {
        case 30:
          return parsers.frenchDrivingLicense(lines, options);
        default:
          throw new Error(`unrecognized document format. First line of input must have 30 (French Driving License) characters and it has a length of ${lines[0].length}`);
      }
    }
    case 2:
    case 3: {
      switch (lines[0].length) {
        case 30:
          return parsers.td1(lines, options);
        case 36: {
          if (lines[0].slice(30, 35).match(/[0-9]/) || lines[0].match(/^IDFRA/)) {
            return parsers.frenchNationalId(lines, options);
          } else {
            return parsers.td2(lines, options);
          }
        }
        case 44:
          return parsers.td3(lines, options);
        case 9:
          return parsers.swissDrivingLicense(lines, options);
        default:
          throw new Error(`unrecognized document format. First line of input must have 30 (TD1), 36 (TD2 or French National Id), 44 (TD3) or 9 (Swiss Driving License) characters and it has a length of ${lines[0].length}`);
      }
    }
    default:
      throw new Error(`unrecognized document format. Input must have one, two or three lines, found ${lines.length}`);
  }
}
var parse_default = parseMRZ;
export {
  formats,
  parse_default as parse,
  states_default as states
};
