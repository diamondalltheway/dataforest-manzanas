import { Hono } from 'hono'
import { prisma } from './lib/server/prisma.js'

const DEFAULT_LIMIT = 5000
const MAX_LIMIT = 10000
const MAX_BBOX_AREA_DEGREES = 0.25
const MAX_BBOX_SPAN_DEGREES = 1

type Bbox = {
  west: number
  south: number
  east: number
  north: number
  values: [number, number, number, number]
}

type ManzanaFeatureRow = {
  id: number
  geometry: Record<string, unknown>
  properties: Record<string, unknown>
}

function parseBbox(searchParams: URLSearchParams): Bbox | string {
  const bbox = searchParams.get('bbox')
  const minLng = searchParams.get('minLng')
  const minLat = searchParams.get('minLat')
  const maxLng = searchParams.get('maxLng')
  const maxLat = searchParams.get('maxLat')

  const value = bbox ?? [minLng, minLat, maxLng, maxLat].join(',')
  if (!bbox && [minLng, minLat, maxLng, maxLat].some((part) => part === null)) {
    return 'Missing bbox. Expected bbox=west,south,east,north or minLng,minLat,maxLng,maxLat query parameters.'
  }

  const parts = value.split(',').map((part) => Number(part.trim()))
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
    return 'Invalid bbox. Expected four numeric values: west,south,east,north.'
  }

  const [west, south, east, north] = parts
  if (west < -180 || east > 180 || south < -90 || north > 90) {
    return 'Invalid bbox. Longitude must be within -180..180 and latitude within -90..90.'
  }

  if (west >= east || south >= north) {
    return 'Invalid bbox. Expected west < east and south < north.'
  }

  return { west, south, east, north, values: [west, south, east, north] }
}

function parseLimit(value: string | null): number | string {
  if (!value) {
    return DEFAULT_LIMIT
  }

  const limit = Number(value)
  if (!Number.isInteger(limit) || limit < 1) {
    return 'Invalid limit. Expected a positive integer.'
  }

  return Math.min(limit, MAX_LIMIT)
}

function isBboxTooLarge({ west, south, east, north }: Bbox) {
  const width = east - west
  const height = north - south

  return (
    width > MAX_BBOX_SPAN_DEGREES ||
    height > MAX_BBOX_SPAN_DEGREES ||
    width * height > MAX_BBOX_AREA_DEGREES
  )
}

const app = new Hono()

app.get('/health', (c) => {
  return c.json({
    ok: true,
    message: 'Manzanas API is healthy',
  })
})

app.get('/api/manzanas', async (c) => {
  const url = new URL(c.req.url)
  const bbox = parseBbox(url.searchParams)
  if (typeof bbox === 'string') {
    return c.json({ error: bbox }, 400)
  }

  if (isBboxTooLarge(bbox)) {
    return c.json(
      {
        error: 'Bbox is too large. Request a smaller map viewport.',
        max_area_degrees: MAX_BBOX_AREA_DEGREES,
        max_span_degrees: MAX_BBOX_SPAN_DEGREES,
      },
      413,
    )
  }

  const limit = parseLimit(url.searchParams.get('limit'))
  if (typeof limit === 'string') {
    return c.json({ error: limit }, 400)
  }

  try {
    const rows = await prisma.$queryRaw<ManzanaFeatureRow[]>`
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
    `

    const truncated = rows.length > limit
    const features = rows.slice(0, limit).map((row) => ({
      type: 'Feature' as const,
      id: row.id,
      geometry: row.geometry,
      properties: row.properties,
    }))

    return c.json({
      type: 'FeatureCollection',
      bbox: bbox.values,
      meta: {
        limit,
        returned: features.length,
        truncated,
      },
      features,
    })
  } catch (error) {
    console.error('Failed to fetch manzanas', error)
    return c.json({ error: 'Failed to fetch manzanas.' }, 500)
  }
})

export default app
