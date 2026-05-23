import { useEffect, useMemo, useState } from "react"
import { useTripStore } from "../store/tripStore"

type BudgetRangeLike = {
  min_amount?: number
  max_amount?: number
  amount?: number
  estimated_total?: number
  estimated_cost?: number
}

type EmojiRule = {
  emoji: string
  keywords: string[]
}

type ImageStyleTone = "cinematic_warm" | "clean_minimal"

type ImageStylePreset = {
  activityImageClass: string
  dayImageClass: string
  dayOverlayClass: string
  dayTagClass: string
  fallbackClass: string
  heroImageClass: string
  heroMetaPillClass: string
  heroOverlayMainClass: string
  heroOverlayToneClass: string
}

const ACTIVE_IMAGE_STYLE_TONE: ImageStyleTone = "clean_minimal"

const IMAGE_STYLE_PRESETS: Record<ImageStyleTone, ImageStylePreset> = {
  cinematic_warm: {
    activityImageClass: "brightness-[0.9] contrast-[1.1] saturate-[1.18] sepia-[0.18]",
    dayImageClass: "brightness-[0.86] contrast-[1.14] saturate-[1.2] sepia-[0.22]",
    dayOverlayClass: "pointer-events-none absolute inset-0 bg-gradient-to-t from-amber-950/65 via-slate-900/25 to-transparent",
    dayTagClass: "absolute bottom-1.5 left-2 rounded-full border border-amber-200/40 bg-slate-900/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-100 backdrop-blur-[2px]",
    fallbackClass: "bg-gradient-to-br from-amber-200 via-rose-100 to-teal-100 text-amber-900",
    heroImageClass: "scale-[1.02] brightness-[0.82] contrast-[1.15] saturate-[1.22] sepia-[0.2]",
    heroMetaPillClass: "rounded-full border border-amber-200/40 bg-slate-900/45 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-100 backdrop-blur-[2px]",
    heroOverlayMainClass: "pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/78 via-slate-900/28 to-transparent",
    heroOverlayToneClass: "pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(251,191,36,0.26)_0%,rgba(251,191,36,0)_35%),radial-gradient(circle_at_82%_12%,rgba(20,184,166,0.18)_0%,rgba(20,184,166,0)_30%)] mix-blend-soft-light",
  },
  clean_minimal: {
    activityImageClass: "brightness-[0.98] contrast-[1.02] saturate-[1.04]",
    dayImageClass: "brightness-[0.96] contrast-[1.03] saturate-[1.05]",
    dayOverlayClass: "pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-900/45 via-slate-900/10 to-transparent",
    dayTagClass: "absolute bottom-1.5 left-2 rounded-full border border-white/50 bg-white/75 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700 backdrop-blur-[2px]",
    fallbackClass: "bg-gradient-to-br from-slate-100 via-white to-teal-50 text-slate-700",
    heroImageClass: "scale-[1.01] brightness-[0.9] contrast-[1.04] saturate-[1.08]",
    heroMetaPillClass: "rounded-full border border-white/65 bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700 backdrop-blur-[2px]",
    heroOverlayMainClass: "pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-900/62 via-slate-900/16 to-transparent",
    heroOverlayToneClass: "pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(255,255,255,0.22)_0%,rgba(255,255,255,0)_38%)]",
  },
}

const ACTIVE_IMAGE_STYLE = IMAGE_STYLE_PRESETS[ACTIVE_IMAGE_STYLE_TONE]

type DestinationImageGuide = {
  cultureQueries: string[]
  foodQueries: string[]
  heroQueries: string[]
  landmarkQueries: string[]
}

type RouteStop = {
  day: number
  label: string
  query: string
}

const DESTINATION_IMAGE_GUIDES: Record<string, DestinationImageGuide> = {
  bengaluru: {
    cultureQueries: ["Bengaluru Cubbon Park", "Vidhana Soudha Bangalore"],
    foodQueries: ["Bangalore masala dosa", "Bengaluru filter coffee"],
    heroQueries: ["Bangalore skyline", "Vidhana Soudha Bengaluru"],
    landmarkQueries: ["Bangalore Palace", "Vidhana Soudha"],
  },
  chennai: {
    cultureQueries: ["Kapaleeshwarar Temple Chennai", "Marina Beach Chennai"],
    foodQueries: ["Chennai idli sambar", "South Indian breakfast Chennai"],
    heroQueries: ["Marina Beach Chennai", "Chennai skyline"],
    landmarkQueries: ["Marina Beach", "Kapaleeshwarar Temple"],
  },
  delhi: {
    cultureQueries: ["India Gate New Delhi", "Humayun's Tomb Delhi"],
    foodQueries: ["Delhi chole bhature", "Paranthe Wali Gali"],
    heroQueries: ["India Gate Delhi", "New Delhi skyline"],
    landmarkQueries: ["Red Fort Delhi", "Qutub Minar"],
  },
  goa: {
    cultureQueries: ["Basilica of Bom Jesus Goa", "Fontainhas Goa"],
    foodQueries: ["Goan fish curry", "Goa seafood thali"],
    heroQueries: ["Goa beach sunset", "Goa coastline"],
    landmarkQueries: ["Dudhsagar Falls", "Fort Aguada Goa"],
  },
  hyderabad: {
    cultureQueries: ["Charminar Hyderabad", "Golconda Fort Hyderabad"],
    foodQueries: ["Hyderabadi biryani", "Irani chai Hyderabad"],
    heroQueries: ["Charminar night view", "Hyderabad skyline"],
    landmarkQueries: ["Charminar", "Golconda Fort"],
  },
  jaipur: {
    cultureQueries: ["Hawa Mahal Jaipur", "Amber Fort Jaipur"],
    foodQueries: ["Jaipur dal baati churma", "Jaipur kachori"],
    heroQueries: ["Hawa Mahal", "Jaipur pink city aerial"],
    landmarkQueries: ["Amer Fort", "Jal Mahal Jaipur"],
  },
  kolkata: {
    cultureQueries: ["Howrah Bridge Kolkata", "Victoria Memorial Kolkata"],
    foodQueries: ["Kolkata kathi roll", "Kolkata rosogolla"],
    heroQueries: ["Howrah Bridge at dusk", "Kolkata skyline"],
    landmarkQueries: ["Victoria Memorial", "Howrah Bridge"],
  },
  mumbai: {
    cultureQueries: ["Gateway of India Mumbai", "Marine Drive Mumbai"],
    foodQueries: ["Mumbai vada pav", "Mumbai pav bhaji"],
    heroQueries: ["Taj Mahal Palace Hotel Mumbai", "Mumbai skyline Marine Drive"],
    landmarkQueries: ["Gateway of India", "Taj Mahal Palace Hotel"],
  },
  shimla: {
    cultureQueries: ["Ridge Shimla", "Christ Church Shimla"],
    foodQueries: ["Himachali cuisine", "Shimla street food"],
    heroQueries: ["Shimla hill station", "Shimla mountain view"],
    landmarkQueries: ["Mall Road Shimla", "Kufri Shimla"],
  },
}

const DESTINATION_ALIAS_MAP: Record<string, string> = {
  bangalore: "bengaluru",
  bombay: "mumbai",
  calcutta: "kolkata",
  "new delhi": "delhi",
}

const FOOD_ACTIVITY_KEYWORDS = [
  "breakfast",
  "brunch",
  "cafe",
  "dinner",
  "food",
  "lunch",
  "meal",
  "restaurant",
  "snack",
  "street food",
]

const LANDMARK_ACTIVITY_KEYWORDS = [
  "fort",
  "heritage",
  "landmark",
  "museum",
  "palace",
  "temple",
]

const BEACH_ACTIVITY_KEYWORDS = ["beach", "coast", "sea", "shore", "sunset"]
const NIGHTLIFE_ACTIVITY_KEYWORDS = ["bar", "club", "music", "nightlife", "party"]

const WIKIPEDIA_SEARCH_API_ENDPOINT = "https://en.wikipedia.org/w/api.php"
const wikipediaImageCache = new Map<string, string | null>()

const normalizeLookupKey = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

const hasAnyKeyword = (value: string, keywords: string[]) =>
  keywords.some((keyword) => value.includes(keyword))

const dedupeQueries = (queries: string[]) =>
  [...new Set(queries.map((query) => query.trim()).filter(Boolean))]

const cleanupLocationLabel = (value: string) =>
  value
    .replace(/^(morning|afternoon|evening|night)\s*:\s*/i, "")
    .replace(/\b(for|with|and then|followed by|before|after)\b.*$/i, "")
    .replace(/[.,;:!?]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()

const extractLocationFromActivity = (activity: string) => {
  const cleanedActivity = cleanupLocationLabel(activity)

  const directiveMatch = cleanedActivity.match(
    /(?:visit|explore|enjoy|relax at|stop at|go to|dinner at|lunch at|breakfast at|head to)\s+(.+)/i
  )
  if (directiveMatch?.[1]) {
    return cleanupLocationLabel(directiveMatch[1])
  }

  const placePrepositionMatch = cleanedActivity.match(/\b(?:at|in|near)\s+(.+)/i)
  if (placePrepositionMatch?.[1]) {
    return cleanupLocationLabel(placePrepositionMatch[1])
  }

  return cleanedActivity
}

const buildRouteStops = (
  destination: string,
  itinerary: { day: number; activities: string[] }[],
  startLocation: string
) => {
  const seenKeys = new Set<string>()
  const routeStops: RouteStop[] = []

  const normalizedDestination = normalizeLookupKey(destination)

  const pushStop = (day: number, label: string, query: string) => {
    const normalizedLabel = normalizeLookupKey(label)
    if (!normalizedLabel || seenKeys.has(normalizedLabel)) {
      return
    }

    routeStops.push({ day, label, query })
    seenKeys.add(normalizedLabel)
  }

  const cleanedStart = cleanupLocationLabel(startLocation)
  if (cleanedStart) {
    pushStop(0, cleanedStart, cleanedStart)
  }

  for (const day of itinerary ?? []) {
    const safeActivities = Array.isArray(day?.activities) ? day.activities : []

    for (const activity of safeActivities) {
      const locationLabel = extractLocationFromActivity(activity)
      if (!locationLabel) {
        continue
      }

      const normalizedLabel = normalizeLookupKey(locationLabel)
      const locationQuery = normalizedLabel.includes(normalizedDestination)
        ? locationLabel
        : `${locationLabel}, ${destination}`

      pushStop(day.day, locationLabel, locationQuery)
      if (routeStops.length >= 9) {
        return routeStops
      }
    }
  }

  if (!routeStops.length) {
    pushStop(1, destination, destination)
  }

  return routeStops
}

const buildRouteEmbedUrl = (routeStops: RouteStop[], destination: string) => {
  if (!routeStops.length) {
    return `https://maps.google.com/maps?hl=en&q=${encodeURIComponent(destination)}&t=m&z=12&output=embed`
  }

  if (routeStops.length === 1) {
    return `https://maps.google.com/maps?hl=en&q=${encodeURIComponent(routeStops[0].query)}&t=m&z=12&output=embed`
  }

  const start = encodeURIComponent(routeStops[0].query)
  const destinations = routeStops.slice(1).map((stop) => encodeURIComponent(stop.query))
  const daddr = destinations.join("+to:")

  return `https://maps.google.com/maps?hl=en&t=m&saddr=${start}&daddr=${daddr}&dirflg=d&output=embed`
}

const buildRouteExternalUrl = (routeStops: RouteStop[], destination: string) => {
  if (!routeStops.length) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}`
  }

  if (routeStops.length === 1) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(routeStops[0].query)}`
  }

  const origin = encodeURIComponent(routeStops[0].query)
  const finalDestination = encodeURIComponent(routeStops[routeStops.length - 1].query)
  const waypointQueries = routeStops
    .slice(1, -1)
    .map((stop) => stop.query)
    .filter(Boolean)

  const waypointsParam = waypointQueries.length
    ? `&waypoints=${encodeURIComponent(waypointQueries.join("|"))}`
    : ""

  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${finalDestination}${waypointsParam}&travelmode=driving`
}

type SuggestionStyle = {
  cardClass: string
  emojiBadgeClass: string
  imageBorderClass: string
  metaPillClass: string
  textClass: string
}

const SUGGESTION_STYLE_BY_TONE: Record<string, SuggestionStyle> = {
  explore: {
    cardClass: "border-teal-200/80 bg-gradient-to-r from-teal-50/70 via-white to-teal-50/35",
    emojiBadgeClass: "border-teal-200 bg-teal-50 text-teal-700",
    imageBorderClass: "border-teal-200/80",
    metaPillClass: "border-teal-200 bg-teal-50/90 text-teal-700",
    textClass: "text-teal-900",
  },
  food: {
    cardClass: "border-teal-200/80 bg-gradient-to-r from-teal-50/70 via-white to-teal-50/35",
    emojiBadgeClass: "border-teal-200 bg-teal-50 text-teal-700",
    imageBorderClass: "border-teal-200/80",
    metaPillClass: "border-teal-200 bg-teal-50/90 text-teal-700",
    textClass: "text-teal-900",
  },
  stay: {
    cardClass: "border-teal-200/80 bg-gradient-to-r from-teal-50/70 via-white to-teal-50/35",
    emojiBadgeClass: "border-teal-200 bg-teal-50 text-teal-700",
    imageBorderClass: "border-teal-200/80",
    metaPillClass: "border-teal-200 bg-teal-50/90 text-teal-700",
    textClass: "text-teal-900",
  },
  transport: {
    cardClass: "border-teal-200/80 bg-gradient-to-r from-teal-50/70 via-white to-teal-50/35",
    emojiBadgeClass: "border-teal-200 bg-teal-50 text-teal-700",
    imageBorderClass: "border-teal-200/80",
    metaPillClass: "border-teal-200 bg-teal-50/90 text-teal-700",
    textClass: "text-teal-900",
  },
}

const resolveSuggestionStyle = (activity: string, category?: string, isSelected = false): SuggestionStyle => {
  const normalizedActivity = normalizeLookupKey(activity)
  const normalizedCategory = normalizeLookupKey(category ?? "")

  let tone: keyof typeof SUGGESTION_STYLE_BY_TONE = "explore"
  if (normalizedCategory.includes("food") || hasAnyKeyword(normalizedActivity, FOOD_ACTIVITY_KEYWORDS)) {
    tone = "food"
  } else if (normalizedCategory.includes("transport") || normalizedActivity.includes("transfer")) {
    tone = "transport"
  } else if (normalizedCategory.includes("stay") || normalizedActivity.includes("check in") || normalizedActivity.includes("hotel")) {
    tone = "stay"
  }

  const base = SUGGESTION_STYLE_BY_TONE[tone]
  if (!isSelected) {
    return base
  }

  return {
    ...base,
    cardClass: `${base.cardClass} ring-2 ring-teal-300/60`,
    textClass: "text-teal-800",
  }
}

const resolveDestinationGuide = (destination: string) => {
  const normalizedDestination = normalizeLookupKey(destination)

  for (const [alias, canonicalKey] of Object.entries(DESTINATION_ALIAS_MAP)) {
    if (normalizedDestination.includes(alias)) {
      return DESTINATION_IMAGE_GUIDES[canonicalKey]
    }
  }

  for (const [key, guide] of Object.entries(DESTINATION_IMAGE_GUIDES)) {
    if (normalizedDestination.includes(key)) {
      return guide
    }
  }

  return null
}

const buildHeroSearchQueries = (destination: string) => {
  const guide = resolveDestinationGuide(destination)
  return dedupeQueries([
    ...(guide?.heroQueries ?? []),
    `${destination} iconic landmark`,
    `${destination} city skyline`,
    `${destination} tourism`,
  ])
}

const buildActivitySearchQueries = (destination: string, dayTitle: string, activity: string) => {
  const guide = resolveDestinationGuide(destination)
  const normalizedActivity = normalizeLookupKey(activity)

  const foodQueries = hasAnyKeyword(normalizedActivity, FOOD_ACTIVITY_KEYWORDS)
    ? guide?.foodQueries ?? []
    : []
  const landmarkQueries = hasAnyKeyword(normalizedActivity, LANDMARK_ACTIVITY_KEYWORDS)
    ? guide?.landmarkQueries ?? []
    : []
  const beachQueries = hasAnyKeyword(normalizedActivity, BEACH_ACTIVITY_KEYWORDS)
    ? [`${destination} beach`, `${destination} coast sunset`]
    : []
  const nightlifeQueries = hasAnyKeyword(normalizedActivity, NIGHTLIFE_ACTIVITY_KEYWORDS)
    ? [`${destination} nightlife`, `${destination} live music`] : []

  return dedupeQueries([
    ...foodQueries,
    ...landmarkQueries,
    ...beachQueries,
    ...nightlifeQueries,
    `${activity} ${destination}`,
    `${destination} ${activity}`,
    `${destination} ${dayTitle} ${activity}`,
    `${destination} local experience`,
  ])
}

const DAY_EMOJI_RULES: EmojiRule[] = [
  { emoji: "🏖️", keywords: ["beach", "sunset", "island", "coast", "shore"] },
  { emoji: "🏛️", keywords: ["museum", "fort", "palace", "heritage", "temple", "culture"] },
  { emoji: "🌆", keywords: ["city", "market", "shopping", "street", "old town"] },
  { emoji: "🌄", keywords: ["hill", "mountain", "trek", "hike", "sunrise", "viewpoint"] },
  { emoji: "🎉", keywords: ["nightlife", "party", "club", "music", "fun"] },
]

const ACTIVITY_EMOJI_RULES: EmojiRule[] = [
  { emoji: "✈️", keywords: ["flight", "airport", "boarding"] },
  { emoji: "🚆", keywords: ["train", "station"] },
  { emoji: "🚌", keywords: ["bus"] },
  { emoji: "🚕", keywords: ["taxi", "cab", "transfer", "ride", "drive"] },
  { emoji: "🏨", keywords: ["hotel", "check in", "check-in", "resort", "stay"] },
  { emoji: "🍽️", keywords: ["food", "meal", "breakfast", "lunch", "dinner", "restaurant", "cafe"] },
  { emoji: "🏖️", keywords: ["beach", "coast", "sea"] },
  { emoji: "🛍️", keywords: ["shopping", "souvenir", "market"] },
  { emoji: "🎟️", keywords: ["ticket", "entry"] },
  { emoji: "🌅", keywords: ["sunset", "sunrise"] },
]

const formatInr = (value: number) => `₹${value.toLocaleString("en-IN")}`

const formatBudgetRange = (value: BudgetRangeLike) => {
  const legacyAmount = value.amount ?? value.estimated_total ?? value.estimated_cost
  const minAmount = typeof value.min_amount === "number" ? value.min_amount : legacyAmount
  const maxAmount = typeof value.max_amount === "number" ? value.max_amount : legacyAmount

  if (typeof minAmount !== "number" || typeof maxAmount !== "number") {
    return "N/A"
  }

  if (minAmount === maxAmount) {
    return formatInr(minAmount)
  }

  return `${formatInr(minAmount)} - ${formatInr(maxAmount)}`
}

const resolveEmoji = (text: string, rules: EmojiRule[], fallback: string) => {
  const normalizedText = text.toLowerCase()
  const match = rules.find((rule) => rule.keywords.some((keyword) => normalizedText.includes(keyword)))
  return match?.emoji ?? fallback
}

const getDayEmoji = (title: string) => resolveEmoji(title, DAY_EMOJI_RULES, "🗺️")
const getActivityEmoji = (activity: string) => resolveEmoji(activity, ACTIVITY_EMOJI_RULES, "📍")

const getCategoryEmoji = (category: string) => {
  const normalized = category.toLowerCase()
  if (normalized.includes("transport")) {
    return "🚕"
  }
  if (normalized.includes("stay")) {
    return "🏨"
  }
  if (normalized.includes("food")) {
    return "🍽️"
  }
  if (normalized.includes("experience")) {
    return "🎯"
  }
  if (normalized.includes("misc")) {
    return "🧾"
  }
  return "💸"
}

const DEFAULT_IMAGE_TAGS = ["travel", "destination", "culture"]

const normalizeImageTag = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token.length >= 3)
    .slice(0, 4)
    .join("-")

const hashToPositiveInt = (value: string) => {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index)
    hash |= 0
  }
  return Math.abs(hash) + 1
}

const buildImageTags = (values: string[]) => {
  const tags = values
    .map((value) => normalizeImageTag(value))
    .filter(Boolean)

  if (!tags.length) {
    return DEFAULT_IMAGE_TAGS.join(",")
  }

  return [...new Set([...tags, ...DEFAULT_IMAGE_TAGS])].slice(0, 5).join(",")
}

const buildImageSources = (tags: string, width: number, height: number) => {
  const lockId = hashToPositiveInt(`${tags}-${width}-${height}`)
  const primary = `https://loremflickr.com/${width}/${height}/${tags}?lock=${lockId}`
  const fallback = `https://picsum.photos/seed/${lockId}-${tags}/${width}/${height}`
  return { primary, fallback }
}

const fetchWikipediaImageForQuery = async (query: string, preferredWidth: number) => {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) {
    return null
  }

  const cacheKey = `${normalizedQuery}::${preferredWidth}`
  if (wikipediaImageCache.has(cacheKey)) {
    return wikipediaImageCache.get(cacheKey) ?? null
  }

  try {
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      generator: "search",
      gsrsearch: normalizedQuery,
      gsrlimit: "4",
      origin: "*",
      pilimit: "4",
      pithumbsize: String(Math.max(preferredWidth, 320)),
      piprop: "thumbnail",
      prop: "pageimages",
    })

    const response = await fetch(`${WIKIPEDIA_SEARCH_API_ENDPOINT}?${params.toString()}`)
    if (!response.ok) {
      wikipediaImageCache.set(cacheKey, null)
      return null
    }

    const payload = await response.json() as {
      query?: {
        pages?: Record<string, {
          index?: number
          thumbnail?: {
            source?: string
          }
        }>
      }
    }

    const pages = Object.values(payload.query?.pages ?? {})
      .sort((first, second) => (first.index ?? Number.MAX_SAFE_INTEGER) - (second.index ?? Number.MAX_SAFE_INTEGER))

    const thumbnailSource = pages.find((page) => page.thumbnail?.source)?.thumbnail?.source ?? null
    wikipediaImageCache.set(cacheKey, thumbnailSource)
    return thumbnailSource
  } catch {
    wikipediaImageCache.set(cacheKey, null)
    return null
  }
}

type TravelImageProps = {
  alt: string
  className: string
  fallbackClassName?: string
  height: number
  searchQueries?: string[]
  tags: string[]
  width: number
}

type TravelImageStatefulProps = {
  alt: string
  className: string
  fallbackClassName: string
  normalizedSearchQueries: string[]
  sources: {
    fallback: string
    primary: string
  }
  width: number
}

function TravelImageStateful({
  alt,
  className,
  fallbackClassName,
  normalizedSearchQueries,
  sources,
  width,
}: TravelImageStatefulProps) {
  const [semanticSource, setSemanticSource] = useState<string | null>(null)
  const [semanticSourceFailed, setSemanticSourceFailed] = useState(false)
  const [sourceIndex, setSourceIndex] = useState(0)
  const [isBroken, setIsBroken] = useState(false)

  useEffect(() => {
    let isCancelled = false

    const resolveSemanticImage = async () => {
      if (!normalizedSearchQueries.length) {
        return
      }

      for (const query of normalizedSearchQueries) {
        const imageUrl = await fetchWikipediaImageForQuery(query, width)
        if (isCancelled) {
          return
        }
        if (imageUrl) {
          setSemanticSource(imageUrl)
          return
        }
      }
    }

    void resolveSemanticImage()

    return () => {
      isCancelled = true
    }
  }, [normalizedSearchQueries, width])

  const activeSource = semanticSource && !semanticSourceFailed
    ? semanticSource
    : sourceIndex === 0
      ? sources.primary
      : sources.fallback

  if (isBroken) {
    return (
      <div
        className={`${className} ${fallbackClassName} flex items-center justify-center text-xl`}
        aria-label={alt}
      >
        <span aria-hidden>🧭</span>
      </div>
    )
  }

  return (
    <img
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => {
        if (semanticSource && !semanticSourceFailed) {
          setSemanticSourceFailed(true)
          return
        }
        if (sourceIndex === 0) {
          setSourceIndex(1)
          return
        }
        setIsBroken(true)
      }}
      src={activeSource}
    />
  )
}

function TravelImage({
  alt,
  className,
  fallbackClassName = ACTIVE_IMAGE_STYLE.fallbackClass,
  height,
  searchQueries = [],
  tags,
  width,
}: TravelImageProps) {
  const normalizedTags = useMemo(() => buildImageTags(tags), [tags])
  const normalizedSearchQueries = useMemo(
    () => dedupeQueries(searchQueries.map((query) => query.trim()).filter(Boolean)),
    [searchQueries]
  )
  const sources = useMemo(
    () => buildImageSources(normalizedTags, width, height),
    [height, normalizedTags, width]
  )
  const resetSignature = `${sources.primary}|${sources.fallback}|${normalizedSearchQueries.join("||")}|${width}`

  return (
    <TravelImageStateful
      key={resetSignature}
      alt={alt}
      className={className}
      fallbackClassName={fallbackClassName}
      normalizedSearchQueries={normalizedSearchQueries}
      sources={sources}
      width={width}
    />
  )
}

function Itinerary() {
  const [editingTarget, setEditingTarget] = useState<{
    day: number
    activityIndex: number
  } | null>(null)
  const [draftActivity, setDraftActivity] = useState("")

  const {
    trip,
    loading,
    startLocation,
    selectedActivities,
    userEdits,
    toggleSelectedActivity,
    deleteActivity,
    editActivity,
    tripMetadata,
    streamingStatus,
  } = useTripStore()

  const budgetBreakdown = trip?.budget_breakdown
  const dayBudgetMap = useMemo(
    () => new Map((budgetBreakdown?.day_breakdown ?? []).map((dayBudget) => [dayBudget.day, dayBudget])),
    [budgetBreakdown]
  )
  const routeStops = useMemo(() => {
    if (!trip) {
      return []
    }
    return buildRouteStops(trip.destination, trip.itinerary, startLocation)
  }, [startLocation, trip])
  const routeEmbedUrl = useMemo(() => {
    if (!trip) {
      return ""
    }
    return buildRouteEmbedUrl(routeStops, trip.destination)
  }, [routeStops, trip])
  const routeExternalUrl = useMemo(() => {
    if (!trip) {
      return ""
    }
    return buildRouteExternalUrl(routeStops, trip.destination)
  }, [routeStops, trip])

  if (!trip) {
    if (loading) {
      return (
        <div className="space-y-4">
          <div className="micro-fade-up rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.06)]">
            <div className="micro-skeleton h-7 w-52 rounded-lg" />
            <div className="mt-3 micro-skeleton h-4 w-36 rounded-md" />
            <div className="mt-6 space-y-3">
              <div className="micro-skeleton h-16 w-full rounded-2xl" />
              <div className="micro-skeleton h-16 w-full rounded-2xl" />
              <div className="micro-skeleton h-16 w-full rounded-2xl" />
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="micro-fade-up micro-hover-lift rounded-3xl border border-slate-200 bg-white p-8 text-slate-500 shadow-[0_12px_32px_rgba(15,23,42,0.06)] transition duration-300 hover:shadow-[0_16px_36px_rgba(15,23,42,0.10)]">
        No trip generated yet. Fill the form or ask the side chat assistant to generate one.
      </div>
    )
  }

  const startEditing = (day: number, activityIndex: number, currentValue: string) => {
    setEditingTarget({ day, activityIndex })
    setDraftActivity(currentValue)
  }

  const saveEditing = () => {
    if (!editingTarget) {
      return
    }

    editActivity(editingTarget.day, editingTarget.activityIndex, draftActivity)
    setEditingTarget(null)
    setDraftActivity("")
  }

  const cancelEditing = () => {
    setEditingTarget(null)
    setDraftActivity("")
  }

  return (
    <div className={`space-y-6 micro-replan-transition ${loading ? "micro-replanning-soften" : ""}`}>

      <div className="micro-fade-up micro-hover-lift rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.06)] transition duration-300 hover:shadow-[0_16px_36px_rgba(15,23,42,0.10)]">
        <h1 className="text-3xl font-semibold text-slate-900">
          {trip ? trip.destination : "AI Trip Planner"}
        </h1>

        {trip && (
          <p className="mt-1 text-slate-600">
            Budget: ₹{trip.total_budget.toLocaleString("en-IN")}
          </p>
        )}

        <p className="mt-2 text-xs text-slate-500">
          Generated {tripMetadata.requestCount} time(s)
          {tripMetadata.lastGeneratedAt ? ` • Last update: ${new Date(tripMetadata.lastGeneratedAt).toLocaleTimeString()}` : ""}
        </p>

        <p className="mt-1 text-xs text-slate-500">
          User edits tracked: {userEdits.length}
        </p>

        {loading && streamingStatus && (
          <p className="micro-pulse mt-3 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-medium text-teal-700">
            {streamingStatus}
          </p>
        )}
      </div>

      <div className="micro-fade-up micro-hover-lift relative overflow-hidden rounded-3xl border border-slate-200 shadow-[0_12px_32px_rgba(15,23,42,0.06)] transition duration-300 hover:shadow-[0_16px_36px_rgba(15,23,42,0.10)]" style={{ animationDelay: "45ms" }}>
        <TravelImage
          alt={`${trip.destination} destination visual`}
          className={`h-60 w-full object-cover ${ACTIVE_IMAGE_STYLE.heroImageClass}`}
          fallbackClassName={ACTIVE_IMAGE_STYLE.fallbackClass}
          height={520}
          searchQueries={buildHeroSearchQueries(trip.destination)}
          tags={[trip.destination, "travel landscape", "city culture"]}
          width={1200}
        />
        <div className={ACTIVE_IMAGE_STYLE.heroOverlayMainClass} />
        <div className={ACTIVE_IMAGE_STYLE.heroOverlayToneClass} />
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <p className="mt-2 text-2xl font-semibold tracking-tight text-white">
            Explore {trip.destination}
          </p>
          <p className="mt-1 text-sm text-white/85">
            Curated visual moodboard for your route and activities.
          </p>
        </div>
      </div>

      <div
        className="micro-fade-up micro-hover-lift rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.06)] transition duration-300 hover:border-sky-100 hover:shadow-[0_16px_38px_rgba(15,23,42,0.10)]"
        style={{ animationDelay: "58ms" }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              Route Map Visualization
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Route map, activity pins, and day-wise markers for {trip.destination}.
            </p>
          </div>

          <a
            className="inline-flex items-center justify-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 transition duration-200 hover:-translate-y-0.5 hover:bg-sky-100 hover:shadow-[0_6px_14px_rgba(14,165,233,0.2)]"
            href={routeExternalUrl}
            rel="noreferrer"
            target="_blank"
          >
            Open in Maps
          </a>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
          <iframe
            className="h-72 w-full"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            src={routeEmbedUrl}
            title={`Route map for ${trip.destination}`}
          />
        </div>

        <div className="micro-stagger mt-4 flex flex-wrap gap-2">
          {routeStops.map((stop, stopIndex) => (
            <div
              key={`${stop.day}-${stop.label}-${stopIndex}`}
              className="inline-flex max-w-full items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 shadow-[0_2px_8px_rgba(15,23,42,0.05)] transition duration-200 hover:-translate-y-0.5 hover:border-sky-200 hover:bg-sky-50/60"
            >
              <span className="inline-flex h-5 min-w-8 items-center justify-center rounded-full bg-slate-900 px-1.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                {stop.day === 0 ? "Start" : `Day ${stop.day}`}
              </span>
              <span className="truncate font-medium" title={stop.label}>
                📍 {stop.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {budgetBreakdown && (
        <div className="micro-fade-up micro-hover-lift rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.06)] transition duration-300 hover:shadow-[0_16px_36px_rgba(15,23,42,0.10)]" style={{ animationDelay: "70ms" }}>
          <h2 className="text-xl font-semibold text-slate-900">
            Budget Breakup ({budgetBreakdown.currency})
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {budgetBreakdown.notes}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-5">
            {(budgetBreakdown.category_totals ?? []).map((category) => (
              <div
                key={category.category}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center transition duration-200 hover:border-teal-100 hover:bg-white"
              >
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  <span className="mr-1.5" aria-hidden>{getCategoryEmoji(category.category)}</span>
                  {category.category}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {formatBudgetRange(category)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {(trip.itinerary ?? []).map((day, dayIndex) => (
        <div
          key={day.day}
          className="micro-fade-up micro-hover-lift micro-replan-transition rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.06)] transition duration-300 hover:border-teal-100 hover:shadow-[0_16px_38px_rgba(15,23,42,0.10)]"
          style={{ animationDelay: `${120 + dayIndex * 70}ms` }}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-xl font-semibold text-slate-900">
              <span className="mr-2" aria-hidden>{getDayEmoji(day.title)}</span>
              Day {day.day}: {day.title}
            </h2>
            {dayBudgetMap.get(day.day) && (
              <p className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">
                {formatBudgetRange(dayBudgetMap.get(day.day) ?? {})}
              </p>
            )}
          </div>

          <ul className="space-y-2">
            {(Array.isArray(day.activities) ? day.activities : [])
              .map((activity, activityIndex) => ({
                activity,
                activityIndex,
                activityKey: `${day.day}:${activity}`,
              }))
              .map(({ activity, activityIndex, activityKey }) => {
                const isSelected = selectedActivities.includes(activityKey)
                const isEditing =
                  editingTarget?.day === day.day && editingTarget?.activityIndex === activityIndex
                const matchedBudgetItem = dayBudgetMap
                  .get(day.day)
                  ?.items.find((item) => item.activity === activity)
                const suggestionStyle = resolveSuggestionStyle(activity, matchedBudgetItem?.category, isSelected)

                return (
                  <li
                    key={`${activity}-${activityIndex}`}
                    className={`micro-fade-up micro-replan-transition transform-gpu rounded-2xl border p-2.5 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-[0_10px_20px_rgba(15,23,42,0.08)] ${suggestionStyle.cardClass}`}
                    style={{ animationDelay: `${200 + dayIndex * 50 + activityIndex * 35}ms` }}
                  >
                    {isEditing ? (
                      <div className="space-y-2">
                        <input
                          className="w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-700"
                          value={draftActivity}
                          onChange={(event) => setDraftActivity(event.target.value)}
                        />

                        <div className="flex gap-2 text-xs">
                          <button
                            onClick={saveEditing}
                            className="rounded bg-emerald-600 px-2 py-1 text-white"
                          >
                            Save
                          </button>

                          <button
                            onClick={cancelEditing}
                            className="rounded bg-slate-500 px-2 py-1 text-white"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <button
                            onClick={() => toggleSelectedActivity(activityKey)}
                            className={`flex items-start text-left text-sm transition ${suggestionStyle.textClass}`}
                          >
                            <TravelImage
                              alt={`${activity} visual`}
                              className={`mr-2 h-10 w-16 shrink-0 rounded-md border object-cover ${ACTIVE_IMAGE_STYLE.activityImageClass} ${suggestionStyle.imageBorderClass}`}
                              fallbackClassName={ACTIVE_IMAGE_STYLE.fallbackClass}
                              height={180}
                              searchQueries={buildActivitySearchQueries(trip.destination, day.title, activity)}
                              tags={[trip.destination, day.title, activity]}
                              width={240}
                            />
                            <span
                              className={`mr-2 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] ${suggestionStyle.emojiBadgeClass}`}
                              aria-hidden
                            >
                              {getActivityEmoji(activity)}
                            </span>
                            <span>{activity}</span>
                          </button>
                          {matchedBudgetItem && (
                            <p className="mt-1">
                              <span
                                className={`inline-flex transform-gpu items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-[0_8px_16px_rgba(13,148,136,0.18)] ${suggestionStyle.metaPillClass}`}
                              >
                                <span aria-hidden>{getCategoryEmoji(matchedBudgetItem.category)}</span>
                                {matchedBudgetItem.category} • {formatBudgetRange(matchedBudgetItem)}
                              </span>
                            </p>
                          )}
                        </div>

                        <div className="flex gap-2 text-xs">
                          <button
                            onClick={() => startEditing(day.day, activityIndex, activity)}
                            className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 font-medium text-teal-700 transition duration-200 hover:-translate-y-0.5 hover:bg-teal-100 hover:shadow-[0_6px_14px_rgba(13,148,136,0.20)]"
                          >
                            Edit
                          </button>

                          <button
                            onClick={() => deleteActivity(day.day, activityIndex)}
                            className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 font-medium text-rose-700 transition duration-200 hover:-translate-y-0.5 hover:bg-rose-100 hover:shadow-[0_6px_14px_rgba(244,63,94,0.20)]"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                )
              })}
          </ul>
        </div>
      ))}

    </div>
  )
}

export default Itinerary
