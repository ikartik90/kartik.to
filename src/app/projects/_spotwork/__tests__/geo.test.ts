import { afterEach, describe, expect, it, vi } from "vitest";
import { COMPANY_PLACE, entranceAt, narrowed, online } from "../geo";

const google = vi.hoisted(() => ({ suggestions: vi.fn(), geocode: vi.fn(), Token: class {} }));

vi.mock("@googlemaps/js-api-loader", () => ({
  setOptions: vi.fn(),
  importLibrary: vi.fn(async (name: string) =>
    name === "places"
      ? { AutocompleteSuggestion: { fetchAutocompleteSuggestions: google.suggestions }, AutocompleteSessionToken: google.Token }
      : {
          Geocoder: class {
            geocode = google.geocode;
          },
        },
  ),
}));

afterEach(() => vi.resetAllMocks());

const place = (label: string) => ({ id: label, label, lat: 0, lng: 0 });

describe("narrowed", () => {
  const found = [place("250 First Gulf Boulevard, Brampton, ON"), place("250 Finnigan Street, Coquitlam, BC")];

  it("keeps the places each of whose typed words begins one of theirs", () => {
    expect(narrowed(found, "250 Fi")).toEqual(found);
    expect(narrowed(found, "250 first g")).toEqual([found[0]]);
    expect(narrowed(found, "  250   Gulf  ")).toEqual([found[0]]);
    expect(narrowed(found, "250 Fir Coq")).toEqual([]);
  });

  it("keeps none for nothing typed", () => {
    expect(narrowed(found, "  ")).toEqual([]);
  });
});

describe("entranceAt", () => {
  it("starts a template at CCLS's First Gulf address at its door, and any other on the wall nearest its address", () => {
    expect(entranceAt(COMPANY_PLACE)).toEqual({ lat: 43.6750896, lng: -79.7128896 });
    expect(entranceAt({ ...COMPANY_PLACE, id: "finnigan" })).toBeNull();
    expect(entranceAt(null)).toBeNull();
  });
});

// Google's place for 12 King Street West, as Place.fetchFields fills it.
const KING = {
  location: { lat: () => 43.6487, lng: () => -79.3779 },
  addressComponents: [
    { longText: "12", types: ["street_number"] },
    { longText: "Toronto", types: ["locality", "political"] },
  ],
  timeZone: { id: "America/Toronto" },
};

const prediction = (placeId: string, text: string, found: object) => {
  const fetchFields = vi.fn(async () => ({ place: found }));
  return { placePrediction: { placeId, text: { toString: () => text }, toPlace: () => ({ fetchFields }) }, fetchFields };
};

describe("the prototype's addresses online", () => {
  it("suggests Google's places in the US and Canada for what's typed, finding the one picked in full", async () => {
    const king = prediction("king", "12 King Street West, Toronto, ON, Canada", KING);
    google.suggestions.mockResolvedValue({ suggestions: [king, { placePrediction: null }] });
    const suggested = await online("maps-key").suggest("12");
    expect(suggested.map(({ id, label }) => ({ id, label }))).toEqual([{ id: "king", label: "12 King Street West, Toronto, ON, Canada" }]);
    expect(google.suggestions).toHaveBeenCalledWith(expect.objectContaining({ input: "12", includedRegionCodes: ["us", "ca"] }));
    expect(await suggested[0].place()).toEqual({
      id: "king",
      label: "12 King Street West, Toronto, ON, Canada",
      city: "Toronto",
      lat: 43.6487,
      lng: -79.3779,
      timezone: "America/Toronto",
    });
    expect(king.fetchFields).toHaveBeenCalledWith({ fields: expect.arrayContaining(["location", "addressComponents", "timeZone"]) });
  });

  it("asks for one address's suggestions under one session, until it's picked", async () => {
    google.suggestions.mockResolvedValue({ suggestions: [prediction("king", "12 King Street West", KING)] });
    const geo = online("maps-key");
    await geo.suggest("1");
    const [king] = await geo.suggest("12");
    await king.place();
    await geo.suggest("4");
    const [first, second, next] = google.suggestions.mock.calls.map(([request]) => request.sessionToken);
    expect(first).toBeInstanceOf(google.Token);
    expect(second).toBe(first);
    expect(next).toBeInstanceOf(google.Token);
    expect(next).not.toBe(first);
  });

  it("suggests its own places where Google can't be asked", async () => {
    google.suggestions.mockRejectedValue(new Error("offline"));
    const ids = async (key: string | null) => (await online(key).suggest("250 First")).map((suggestion) => suggestion.id);
    expect(await ids("maps-key")).toEqual([COMPANY_PLACE.id]);
    expect(await ids(null)).toEqual([COMPANY_PLACE.id]);
  });

  it("names a point by Google's geocoder, or not at all where it can't", async () => {
    google.geocode.mockResolvedValue({
      results: [
        {
          place_id: "bramwin",
          formatted_address: "8 Bramwin Ct, Brampton, ON L6T 5G2, Canada",
          address_components: [{ long_name: "Brampton", types: ["locality", "political"] }],
        },
      ],
    });
    const at = { lat: 43.7208, lng: -79.6859 };
    expect(await online("maps-key").address(at)).toEqual({
      id: "bramwin",
      label: "8 Bramwin Ct, Brampton, ON L6T 5G2, Canada",
      city: "Brampton",
      ...at,
    });
    expect(google.geocode).toHaveBeenCalledWith({ location: at });
    google.geocode.mockRejectedValue(new Error("REQUEST_DENIED"));
    expect(await online("maps-key").address(at)).toBeNull();
    expect(await online(null).address(at)).toBeNull();
  });
});
