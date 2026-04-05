/**
 * Partner Dashboard Banner Configuration
 * Professional images from Unsplash with motivational quotes for each partner sub-role
 */

export interface BannerConfig {
  images: string[]
  quotes: string[]
}

interface PartnerBannersConfig {
  [key: string]: BannerConfig
}

/**
 * Get a random item from an array
 */
const getRandomItem = <T,>(array: T[]): T => {
  return array[Math.floor(Math.random() * array.length)]
}

/**
 * Banner configurations for each partner sub-role
 * Images are professional, high-quality Unsplash photos relevant to each role
 */
export const PARTNER_BANNERS: PartnerBannersConfig = {
  BUSINESS_ASSOCIATE: {
    images: [
      'https://images.unsplash.com/photo-1556761175-b413da4baf72?w=1200&h=400&fit=crop&q=80', // Business partnership
      'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&h=400&fit=crop&q=80', // Professional meeting
      'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=1200&h=400&fit=crop&q=80', // Business collaboration
      'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=1200&h=400&fit=crop&q=80', // Business success
      'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=1200&h=400&fit=crop&q=80', // Team collaboration
    ],
    quotes: [
      'Your network is your net worth',
      'Every connection is an opportunity to grow',
      'Building relationships that create prosperity',
      'Success is built one partnership at a time',
      'Your growth is our success',
      'Empowering businesses through strategic partnerships',
      'Together, we achieve extraordinary results',
    ]
  },

  BUSINESS_PARTNER: {
    images: [
      'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1200&h=400&fit=crop&q=80', // Business strategy
      'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&h=400&fit=crop&q=80', // Business analytics
      'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1200&h=400&fit=crop&q=80', // Partnership success
      'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200&h=400&fit=crop&q=80', // Business leadership
      'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=1200&h=400&fit=crop&q=80', // Business planning
    ],
    quotes: [
      'Strategic partnerships drive exponential growth',
      'Your vision, our commitment to excellence',
      'Building empires through collaboration',
      'Partnership multiplies success manifold',
      'Together, we create market leaders',
      'Your success story is our shared journey',
      'Excellence in partnership, excellence in results',
    ]
  },

  CHANNEL_PARTNER: {
    images: [
      'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=1200&h=400&fit=crop&q=80', // Business growth
      'https://images.unsplash.com/photo-1556740758-90de374c12ad?w=1200&h=400&fit=crop&q=80', // Channel expansion
      'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=1200&h=400&fit=crop&q=80', // Professional success
      'https://images.unsplash.com/photo-1551650975-87deedd944c3?w=1200&h=400&fit=crop&q=80', // Digital growth
      'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=1200&h=400&fit=crop&q=80', // Team success
    ],
    quotes: [
      'Expanding horizons, multiplying opportunities',
      'Your reach amplifies our collective success',
      'Channel excellence drives market dominance',
      'Connecting opportunities, creating prosperity',
      'Strategic distribution, exponential growth',
      'Your network creates limitless possibilities',
      'Building bridges to success together',
    ]
  },
}

/**
 * Get a random banner for login (image + quote)
 * Returns a different image and quote on each login
 */
export function getLoginBanner(subRole: string): { image: string; quote: string } | null {
  const config = PARTNER_BANNERS[subRole]
  if (!config) {
    return null
  }

  return {
    image: getRandomItem(config.images),
    quote: getRandomItem(config.quotes)
  }
}
