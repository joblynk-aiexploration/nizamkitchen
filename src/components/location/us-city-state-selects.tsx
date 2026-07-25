"use client";

import { useMemo, useState } from "react";
import { SelectInput } from "@/components/ui/select-input";

const US_STATES = [
  { value: "AL", label: "Alabama" },
  { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },
  { value: "DE", label: "Delaware" },
  { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" },
];

const CITIES_BY_STATE: Record<string, string[]> = {
  AL: ["Birmingham", "Huntsville", "Mobile", "Montgomery", "Tuscaloosa"],
  AK: ["Anchorage", "Fairbanks", "Juneau", "Sitka", "Wasilla"],
  AZ: ["Phoenix", "Tucson", "Mesa", "Chandler", "Scottsdale"],
  AR: ["Little Rock", "Fayetteville", "Fort Smith", "Springdale", "Jonesboro"],
  CA: ["Los Angeles", "San Diego", "San Jose", "San Francisco", "Fresno", "Sacramento", "Irvine"],
  CO: ["Denver", "Colorado Springs", "Aurora", "Fort Collins", "Boulder"],
  CT: ["Bridgeport", "New Haven", "Stamford", "Hartford", "Waterbury"],
  DE: ["Wilmington", "Dover", "Newark", "Middletown", "Smyrna"],
  FL: ["Jacksonville", "Miami", "Tampa", "Orlando", "St. Petersburg", "Fort Lauderdale"],
  GA: ["Atlanta", "Augusta", "Columbus", "Savannah", "Athens"],
  HI: ["Honolulu", "Hilo", "Kailua", "Kapolei", "Kaneohe"],
  ID: ["Boise", "Meridian", "Nampa", "Idaho Falls", "Pocatello"],
  IL: ["Chicago", "Aurora", "Naperville", "Joliet", "Rockford", "Springfield"],
  IN: ["Indianapolis", "Fort Wayne", "Evansville", "South Bend", "Carmel"],
  IA: ["Des Moines", "Cedar Rapids", "Davenport", "Sioux City", "Iowa City"],
  KS: ["Wichita", "Overland Park", "Kansas City", "Olathe", "Topeka"],
  KY: ["Louisville", "Lexington", "Bowling Green", "Owensboro", "Covington"],
  LA: ["New Orleans", "Baton Rouge", "Shreveport", "Lafayette", "Lake Charles"],
  ME: ["Portland", "Lewiston", "Bangor", "South Portland", "Auburn"],
  MD: ["Baltimore", "Frederick", "Rockville", "Gaithersburg", "Bowie"],
  MA: ["Boston", "Worcester", "Springfield", "Cambridge", "Lowell"],
  MI: ["Detroit", "Grand Rapids", "Warren", "Sterling Heights", "Ann Arbor"],
  MN: ["Minneapolis", "Saint Paul", "Rochester", "Duluth", "Bloomington"],
  MS: ["Jackson", "Gulfport", "Southaven", "Biloxi", "Hattiesburg"],
  MO: ["Kansas City", "St. Louis", "Springfield", "Columbia", "Independence"],
  MT: ["Billings", "Missoula", "Great Falls", "Bozeman", "Butte"],
  NE: ["Omaha", "Lincoln", "Bellevue", "Grand Island", "Kearney"],
  NV: ["Las Vegas", "Henderson", "Reno", "North Las Vegas", "Sparks"],
  NH: ["Manchester", "Nashua", "Concord", "Derry", "Dover"],
  NJ: ["Newark", "Jersey City", "Paterson", "Elizabeth", "Edison"],
  NM: ["Albuquerque", "Las Cruces", "Rio Rancho", "Santa Fe", "Roswell"],
  NY: ["New York", "Buffalo", "Rochester", "Yonkers", "Syracuse", "Albany"],
  NC: ["Charlotte", "Raleigh", "Greensboro", "Durham", "Winston-Salem"],
  ND: ["Fargo", "Bismarck", "Grand Forks", "Minot", "West Fargo"],
  OH: ["Columbus", "Cleveland", "Cincinnati", "Toledo", "Akron"],
  OK: ["Oklahoma City", "Tulsa", "Norman", "Broken Arrow", "Edmond"],
  OR: ["Portland", "Eugene", "Salem", "Gresham", "Hillsboro"],
  PA: ["Philadelphia", "Pittsburgh", "Allentown", "Erie", "Reading"],
  RI: ["Providence", "Warwick", "Cranston", "Pawtucket", "East Providence"],
  SC: ["Charleston", "Columbia", "North Charleston", "Mount Pleasant", "Rock Hill"],
  SD: ["Sioux Falls", "Rapid City", "Aberdeen", "Brookings", "Watertown"],
  TN: ["Nashville", "Memphis", "Knoxville", "Chattanooga", "Clarksville"],
  TX: ["Houston", "San Antonio", "Dallas", "Austin", "Fort Worth", "Frisco", "Plano", "Irving", "Richardson", "McKinney", "Allen"],
  UT: ["Salt Lake City", "West Valley City", "Provo", "West Jordan", "Orem"],
  VT: ["Burlington", "South Burlington", "Rutland", "Barre", "Montpelier"],
  VA: ["Virginia Beach", "Chesapeake", "Norfolk", "Richmond", "Arlington"],
  WA: ["Seattle", "Spokane", "Tacoma", "Vancouver", "Bellevue"],
  WV: ["Charleston", "Huntington", "Morgantown", "Parkersburg", "Wheeling"],
  WI: ["Milwaukee", "Madison", "Green Bay", "Kenosha", "Racine"],
  WY: ["Cheyenne", "Casper", "Laramie", "Gillette", "Rock Springs"],
};

function optionsWithCurrent(options: Array<{ value: string; label: string }>, currentValue?: string | null, placeholder = "Choose option") {
  const value = String(currentValue ?? "").trim();
  const base = [{ value: "", label: placeholder }, ...options];
  return value && !base.some((option) => option.value.toLowerCase() === value.toLowerCase())
    ? [{ value, label: value }, ...base]
    : base;
}

export function UsCityStateSelects({
  defaultCity,
  defaultState,
}: {
  defaultCity?: string | null;
  defaultState?: string | null;
}) {
  const [selectedState, setSelectedState] = useState(String(defaultState ?? ""));
  const cityOptions = useMemo(() => {
    const cities = (CITIES_BY_STATE[selectedState] ?? []).map((city) => ({ value: city, label: city }));
    return optionsWithCurrent(cities, defaultCity, selectedState ? "Choose city" : "Choose state first");
  }, [defaultCity, selectedState]);

  return (
    <>
      <SelectInput
        label="Base state"
        name="baseRegion"
        value={selectedState}
        onChange={(event) => setSelectedState(event.target.value)}
        options={optionsWithCurrent(US_STATES, defaultState, "Choose state")}
      />
      <SelectInput
        label="Base city"
        name="baseCity"
        defaultValue={defaultCity ?? ""}
        disabled={!selectedState}
        options={cityOptions}
      />
    </>
  );
}
