import { Hono } from "hono";
import { prisma } from "./lib/server/prisma.js";

const DEFAULT_LIMIT = 5000;
const MAX_LIMIT = 10000;
const MAX_BBOX_AREA_DEGREES = 0.25;
const MAX_BBOX_SPAN_DEGREES = 1;

type Bbox = {
  west: number;
  south: number;
  east: number;
  north: number;
  values: [number, number, number, number];
};

type FeatureRow = {
  id: number;
  geometry: Record<string, unknown>;
  properties: Record<string, unknown>;
};

const MANZANAS_CATALOG = {
  table: "public.manzanas",
  source: "DANE MGN 2018 / CNPV 2018 integrated manzana fields",
  columns: {
    ogc_fid: "Unique row identifier for the manzana feature.",
    geom: "MultiPolygon geometry for the manzana in EPSG:4326.",
    cod_dane_a:
      "Concatenated DANE manzana code: department, municipality, class, rural sector, rural section, urban zone, urban sector, urban section, and manzana.",
    dpto_ccdgo: "Department code.",
    mpio_ccdgo: "Municipality code.",
    mpio_cdpmp: "Concatenated department and municipality code.",
    clas_ccdgo:
      "Class code: 1 municipal seat, 2 populated center, 3 rural/rest area.",
    setr_ccdgo: "Rural sector code.",
    setr_ccnct:
      "Concatenated rural sector code: department, municipality, class, and rural sector.",
    secr_ccdgo: "Rural section code.",
    secr_ccnct:
      "Concatenated rural section code: department, municipality, class, rural sector, and rural section.",
    zu_ccdgo: "Urban zone code for municipal seats and populated centers.",
    zu_cdivi:
      "Concatenated urban zone code: department, municipality, and urban zone.",
    setu_ccdgo: "Urban sector code.",
    setu_ccnct:
      "Concatenated urban sector code: department, municipality, class, rural sector, rural section, urban zone, and urban sector.",
    secu_ccdgo: "Urban section code.",
    secu_ccnct:
      "Concatenated urban section code: department, municipality, class, rural sector, rural section, urban zone, urban sector, and urban section.",
    manz_ccdgo: "Manzana code.",
    ag_ccdgo: "Geographic area code.",
    dato_anm: "Anonymized layer name.",
    version: "Year of the geographic information.",
    area: "Manzana area in square meters.",
    latitud: "Latitude coordinate of the manzana centroid.",
    longitud: "Longitude coordinate of the manzana centroid.",
    densidad:
      "Average number of inhabitants in the manzana per square meter.",
    ctnencuest: "Number of CNPV 2018 census surveys.",
    tp3_1_si: "Survey count reporting location in ethnic territory.",
    tp3_2_no: "Survey count reporting location not in ethnic territory.",
    tp3a_ri:
      "Survey count reporting location in an indigenous reservation ethnic territory.",
    tp3b_tcn:
      "Survey count reporting location in a collective territory of Black communities.",
    tp4_1_si: "Survey count reporting location in protected areas.",
    tp4_2_no: "Survey count reporting location not in protected areas.",
    tp9_1_uso: "Count of units with housing use.",
    tp9_2_uso: "Count of units with mixed use.",
    tp9_3_uso: "Count of units with non-residential use.",
    tp9_4_uso: "Count of units with special accommodation place use.",
    tp9_2_1_mi:
      "Count of mixed-use units with non-residential industrial use.",
    tp9_2_2_mi:
      "Count of mixed-use units with non-residential commercial use.",
    tp9_2_3_mi:
      "Count of mixed-use units with non-residential services use.",
    tp9_2_4_mi:
      "Count of mixed-use units with non-residential agricultural, agroindustrial, or forestry use.",
    tp9_2_9_mi:
      "Count of mixed-use units with non-residential use and no information.",
    tp9_3_1_no: "Count of non-residential units with industrial use.",
    tp9_3_2_no: "Count of non-residential units with commercial use.",
    tp9_3_3_no: "Count of non-residential units with services use.",
    tp9_3_4_no:
      "Count of non-residential units with agricultural, agroindustrial, or forestry use.",
    tp9_3_5_no: "Count of non-residential units with institutional use.",
    tp9_3_6_no:
      "Count of non-residential units with lot use, meaning a unit without construction.",
    tp9_3_7_no: "Count of non-residential units with park or green-zone use.",
    tp9_3_8_no: "Count of non-residential units with mining-energy use.",
    tp9_3_9_no:
      "Count of non-residential units with environmental protection or conservation use.",
    tp9_3_10_n: "Count of non-residential units under construction.",
    tp9_3_99_n:
      "Count of non-residential units with no use information.",
    tvivienda: "Count of housing units.",
    tp14_1_tip: "Count of housing units of type house.",
    tp14_2_tip: "Count of housing units of type apartment.",
    tp14_3_tip: "Count of housing units of type room.",
    tp14_4_tip: "Count of housing units of traditional indigenous type.",
    tp14_5_tip:
      "Count of housing units of traditional ethnic type, including Afro-Colombian, islander, and Rrom housing.",
    tp14_6_tip:
      "Count of housing units of other type, such as container, tent, boat, wagon, cave, or natural shelter.",
    tp15_1_ocu: "Count of occupied housing units with people present.",
    tp15_2_ocu:
      "Count of occupied housing units with all people absent.",
    tp15_3_ocu:
      "Count of temporary housing units for vacation, work, or similar use.",
    tp15_4_ocu: "Count of unoccupied housing units.",
    tp16_hog: "Count of households.",
    tp19_ee_1: "Count of housing units with electric power service.",
    tp19_ee_2: "Count of housing units without electric power service.",
    tp19_ee_e1:
      "Count of housing units reporting electric power billing in stratum 1.",
    tp19_ee_e2:
      "Count of housing units reporting electric power billing in stratum 2.",
    tp19_ee_e3:
      "Count of housing units reporting electric power billing in stratum 3.",
    tp19_ee_e4:
      "Count of housing units reporting electric power billing in stratum 4.",
    tp19_ee_e5:
      "Count of housing units reporting electric power billing in stratum 5.",
    tp19_ee_e6:
      "Count of housing units reporting electric power billing in stratum 6.",
    tp19_ee_e9:
      "Count of housing units reporting unknown electric power billing stratum or no stratum.",
    tp19_acu_1: "Count of housing units with aqueduct service.",
    tp19_acu_2: "Count of housing units without aqueduct service.",
    tp19_alc_1: "Count of housing units with sewer service.",
    tp19_alc_2: "Count of housing units without sewer service.",
    tp19_gas_1:
      "Count of housing units with natural gas service connected to the public network.",
    tp19_gas_2:
      "Count of housing units without natural gas service connected to the public network.",
    tp19_gas_9:
      "Count of housing units with no information about natural gas service connected to the public network.",
    tp19_recb1: "Count of housing units with garbage collection service.",
    tp19_recb2: "Count of housing units without garbage collection service.",
    tp19_inte1: "Count of housing units with internet service.",
    tp19_inte2: "Count of housing units without internet service.",
    tp19_inte9: "Count of housing units with no internet service information.",
    tp27_perso: "Number of people.",
    personas_l: "Count of people in special accommodation places.",
    personas_s: "Count of people in private households.",
    tp32_1_sex: "Count of men.",
    tp32_2_sex: "Count of women.",
    tp34_1_eda: "Count of people aged 0 to 9 years.",
    tp34_2_eda: "Count of people aged 10 to 19 years.",
    tp34_3_eda: "Count of people aged 20 to 29 years.",
    tp34_4_eda: "Count of people aged 30 to 39 years.",
    tp34_5_eda: "Count of people aged 40 to 49 years.",
    tp34_6_eda: "Count of people aged 50 to 59 years.",
    tp34_7_eda: "Count of people aged 60 to 69 years.",
    tp34_8_eda: "Count of people aged 70 to 79 years.",
    tp34_9_eda: "Count of people aged 80 years and older.",
    tp51primar:
      "Count of people whose highest education level reached is preschool, pre-kindergarten, or basic primary.",
    tp51secund:
      "Count of people whose highest education level reached is basic secondary or middle education.",
    tp51superi:
      "Count of people whose highest education level reached is technical, technological, or university education.",
    tp51postgr:
      "Count of people whose highest education level reached is specialization, master's, or doctorate.",
    tp51_13_ed: "Count of people whose highest education level reached is none.",
    tp51_99_ed:
      "Count of people with no information for highest education level reached.",
    cd_lc_cm: "Locality or commune code.",
    nmb_lc_cm: "Locality or commune name.",
    tp_lc_cm: "Locality, commune, or corregimiento type description.",
    shape_leng: "Geometry length or perimeter metadata.",
    shape_area: "Geometry area metadata.",
    cod_rdtm:
      "24-position concatenated RDTM code: department, municipality, class, locality, rural sector, rural section, populated center, urban sector, urban section, and manzana.",
  },
} as const;

const BROADBAND_PERFORMANCE_TILES_CATALOG = {
  table: "public.broadband_performance_tiles",
  source: "Broadband performance tiles shapefile",
  columns: {
    ogc_fid: "Unique row identifier for the broadband performance tile.",
    geom: "Polygon geometry for the broadband performance tile in EPSG:4326.",
    quadkey: "Bing Maps quadkey identifying the zoom-16 tile.",
    avg_d_kbps: "Average fixed broadband download speed in kilobits per second.",
    avg_u_kbps: "Average fixed broadband upload speed in kilobits per second.",
    avg_lat_ms: "Average fixed broadband latency in milliseconds.",
    tests: "Number of speed tests represented by the tile.",
    devices: "Number of devices represented by the tile.",
  },
} as const;

const VIAS_CATALOG = {
  table: "public.vias",
  source: "VIAS shapefile",
  columns: {
    ogc_fid: "Unique row identifier for the road feature.",
    geom: "MultiLineString geometry for the road feature in EPSG:4326.",
    objectid: "Source object identifier.",
    fid_mgn_ad: "Source MGN administrative feature identifier.",
    dpto_ccdgo: "Department code.",
    dpto_nano_: "Source department year or numeric metadata field.",
    dpto_cnmbr: "Department name.",
    dpto_cacto: "Department act metadata.",
    dpto_narea: "Department area metadata.",
    dpto_csmbl: "Department symbol code metadata.",
    dpto_nano: "Department year metadata.",
    pais_pais_: "Country code metadata.",
    shape_leng: "Administrative geometry length metadata.",
    fid_roads: "Source roads feature identifier.",
    osm_id: "OpenStreetMap road identifier.",
    name: "Road name.",
    ref: "Road reference code.",
    type: "OpenStreetMap road type.",
    oneway: "One-way road flag.",
    bridge: "Bridge flag.",
    tunnel: "Tunnel flag.",
    maxspeed: "Maximum speed metadata.",
    shape_le_1: "Road geometry length metadata.",
  },
} as const;

function parseBbox(searchParams: URLSearchParams): Bbox | string {
  const bbox = searchParams.get("bbox");
  const minLng = searchParams.get("minLng");
  const minLat = searchParams.get("minLat");
  const maxLng = searchParams.get("maxLng");
  const maxLat = searchParams.get("maxLat");

  const value = bbox ?? [minLng, minLat, maxLng, maxLat].join(",");
  if (!bbox && [minLng, minLat, maxLng, maxLat].some((part) => part === null)) {
    return "Missing bbox. Expected bbox=west,south,east,north or minLng,minLat,maxLng,maxLat query parameters.";
  }

  const parts = value.split(",").map((part) => Number(part.trim()));
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
    return "Invalid bbox. Expected four numeric values: west,south,east,north.";
  }

  const [west, south, east, north] = parts;
  if (west < -180 || east > 180 || south < -90 || north > 90) {
    return "Invalid bbox. Longitude must be within -180..180 and latitude within -90..90.";
  }

  if (west >= east || south >= north) {
    return "Invalid bbox. Expected west < east and south < north.";
  }

  return { west, south, east, north, values: [west, south, east, north] };
}

function parseLimit(value: string | null): number | string {
  if (!value) {
    return DEFAULT_LIMIT;
  }

  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1) {
    return "Invalid limit. Expected a positive integer.";
  }

  return Math.min(limit, MAX_LIMIT);
}

function isBboxTooLarge({ west, south, east, north }: Bbox) {
  const width = east - west;
  const height = north - south;

  return (
    width > MAX_BBOX_SPAN_DEGREES ||
    height > MAX_BBOX_SPAN_DEGREES ||
    width * height > MAX_BBOX_AREA_DEGREES
  );
}

const app = new Hono();

app.get("/health", (c) => {
  return c.json({
    ok: true,
    message: "Manzanas API is healthy",
  });
});

app.get("/api/catalog/manzanas", (c) => {
  return c.json(MANZANAS_CATALOG);
});

app.get("/api/catalog/broadband-performance-tiles", (c) => {
  return c.json(BROADBAND_PERFORMANCE_TILES_CATALOG);
});

app.get("/api/catalog/vias", (c) => {
  return c.json(VIAS_CATALOG);
});

app.get("/api/manzanas", async (c) => {
  const url = new URL(c.req.url);
  const bbox = parseBbox(url.searchParams);
  if (typeof bbox === "string") {
    return c.json({ error: bbox }, 400);
  }

  if (isBboxTooLarge(bbox)) {
    return c.json(
      {
        error: "Bbox is too large. Request a smaller map viewport.",
        max_area_degrees: MAX_BBOX_AREA_DEGREES,
        max_span_degrees: MAX_BBOX_SPAN_DEGREES,
      },
      413,
    );
  }

  const limit = parseLimit(url.searchParams.get("limit"));
  if (typeof limit === "string") {
    return c.json({ error: limit }, 400);
  }

  try {
    const rows = await prisma.$queryRaw<FeatureRow[]>`
      WITH bbox AS (
        SELECT ST_MakeEnvelope(${bbox.west}, ${bbox.south}, ${bbox.east}, ${bbox.north}, 4326) AS geom
      )
      SELECT
        m.ogc_fid AS id,
        ST_AsGeoJSON(m.geom, 6)::jsonb AS geometry,
        to_jsonb(m) - 'geom' AS properties
      FROM public.manzanas m, bbox
      WHERE m.geom && bbox.geom
        AND ST_Intersects(m.geom, bbox.geom)
      ORDER BY m.ogc_fid
      LIMIT ${limit + 1};
    `;

    const truncated = rows.length > limit;
    const features = rows.slice(0, limit).map((row) => ({
      type: "Feature" as const,
      id: row.id,
      geometry: row.geometry,
      properties: row.properties,
    }));

    return c.json({
      type: "FeatureCollection",
      bbox: bbox.values,
      meta: {
        limit,
        returned: features.length,
        truncated,
      },
      features,
    });
  } catch (error) {
    console.error("Failed to fetch manzanas", error);
    return c.json({ error: "Failed to fetch manzanas." }, 500);
  }
});

app.get("/api/broadband-performance-tiles", async (c) => {
  const url = new URL(c.req.url);
  const bbox = parseBbox(url.searchParams);
  if (typeof bbox === "string") {
    return c.json({ error: bbox }, 400);
  }

  if (isBboxTooLarge(bbox)) {
    return c.json(
      {
        error: "Bbox is too large. Request a smaller map viewport.",
        max_area_degrees: MAX_BBOX_AREA_DEGREES,
        max_span_degrees: MAX_BBOX_SPAN_DEGREES,
      },
      413,
    );
  }

  const limit = parseLimit(url.searchParams.get("limit"));
  if (typeof limit === "string") {
    return c.json({ error: limit }, 400);
  }

  try {
    const rows = await prisma.$queryRaw<FeatureRow[]>`
      WITH bbox AS (
        SELECT ST_MakeEnvelope(${bbox.west}, ${bbox.south}, ${bbox.east}, ${bbox.north}, 4326) AS geom
      )
      SELECT
        b.ogc_fid AS id,
        ST_AsGeoJSON(b.geom, 6)::jsonb AS geometry,
        to_jsonb(b) - 'geom' AS properties
      FROM public.broadband_performance_tiles b, bbox
      WHERE b.geom && bbox.geom
        AND ST_Intersects(b.geom, bbox.geom)
      ORDER BY b.ogc_fid
      LIMIT ${limit + 1};
    `;

    const truncated = rows.length > limit;
    const features = rows.slice(0, limit).map((row) => ({
      type: "Feature" as const,
      id: row.id,
      geometry: row.geometry,
      properties: row.properties,
    }));

    return c.json({
      type: "FeatureCollection",
      bbox: bbox.values,
      meta: {
        limit,
        returned: features.length,
        truncated,
      },
      features,
    });
  } catch (error) {
    console.error("Failed to fetch broadband performance tiles", error);
    return c.json(
      { error: "Failed to fetch broadband performance tiles." },
      500,
    );
  }
});

app.get("/api/vias", async (c) => {
  const url = new URL(c.req.url);
  const bbox = parseBbox(url.searchParams);
  if (typeof bbox === "string") {
    return c.json({ error: bbox }, 400);
  }

  if (isBboxTooLarge(bbox)) {
    return c.json(
      {
        error: "Bbox is too large. Request a smaller map viewport.",
        max_area_degrees: MAX_BBOX_AREA_DEGREES,
        max_span_degrees: MAX_BBOX_SPAN_DEGREES,
      },
      413,
    );
  }

  const limit = parseLimit(url.searchParams.get("limit"));
  if (typeof limit === "string") {
    return c.json({ error: limit }, 400);
  }

  try {
    const rows = await prisma.$queryRaw<FeatureRow[]>`
      WITH bbox AS (
        SELECT ST_MakeEnvelope(${bbox.west}, ${bbox.south}, ${bbox.east}, ${bbox.north}, 4326) AS geom
      )
      SELECT
        v.ogc_fid AS id,
        ST_AsGeoJSON(v.geom, 6)::jsonb AS geometry,
        to_jsonb(v) - 'geom' AS properties
      FROM public.vias v, bbox
      WHERE v.geom && bbox.geom
        AND ST_Intersects(v.geom, bbox.geom)
      ORDER BY v.ogc_fid
      LIMIT ${limit + 1};
    `;

    const truncated = rows.length > limit;
    const features = rows.slice(0, limit).map((row) => ({
      type: "Feature" as const,
      id: row.id,
      geometry: row.geometry,
      properties: row.properties,
    }));

    return c.json({
      type: "FeatureCollection",
      bbox: bbox.values,
      meta: {
        limit,
        returned: features.length,
        truncated,
      },
      features,
    });
  } catch (error) {
    console.error("Failed to fetch vias", error);
    return c.json({ error: "Failed to fetch vias." }, 500);
  }
});

export default app;
