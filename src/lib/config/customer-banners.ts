/**
 * Customer Dashboard Banner Configuration
 * Professional images from Unsplash with motivational quotes for each customer sub-role
 */

export interface BannerConfig {
  images: string[]
  quotes: string[]
}

interface CustomerBannersConfig {
  [key: string]: BannerConfig
}

/**
 * Get a random item from an array
 */
const getRandomItem = <T,>(array: T[]): T => {
  return array[Math.floor(Math.random() * array.length)]
}

/**
 * Banner configurations for each customer sub-role
 * Images are professional, high-quality Unsplash photos relevant to each role
 */
export const CUSTOMER_BANNERS: CustomerBannersConfig = {
  INDIVIDUAL: {
    images: [
      'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1200&h=400&fit=crop&q=80', // Modern home
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&h=400&fit=crop&q=80', // Dream home
      'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=1200&h=400&fit=crop&q=80', // Beautiful house
      'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1200&h=400&fit=crop&q=80', // Residential property
      'https://images.unsplash.com/photo-1605146769289-440113cc3d00?w=1200&h=400&fit=crop&q=80', // Home exterior
    ],
    quotes: [
      'Your dream home is within reach',
      'Building a brighter future, one step at a time',
      'Home is where your story begins',
      'Turning aspirations into reality',
      'Invest in your future, invest in yourself',
      'Every journey starts with a single step',
      'Your financial goals are achievable',
    ]
  },

  SALARIED: {
    images: [
      'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&h=400&fit=crop&q=80', // Modern office
      'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&h=400&fit=crop&q=80', // Professional workspace
      'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=1200&h=400&fit=crop&q=80', // Business environment
      'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1200&h=400&fit=crop&q=80', // Corporate setting
      'https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=1200&h=400&fit=crop&q=80', // Professional life
    ],
    quotes: [
      'Your hard work deserves the best financial support',
      'Achieving your goals with confidence',
      'Financial freedom starts with the right decisions',
      'Invest in your dreams, secure your future',
      'Your stability is our priority',
      'Building wealth one smart decision at a time',
      'Empowering your financial journey',
    ]
  },

  PROPRIETOR: {
    images: [
      'https://images.unsplash.com/photo-1556761175-b413da4baf72?w=1200&h=400&fit=crop&q=80', // Small business
      'https://images.unsplash.com/photo-1556740758-90de374c12ad?w=1200&h=400&fit=crop&q=80', // Business growth
      'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=1200&h=400&fit=crop&q=80', // Entrepreneurship
      'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=1200&h=400&fit=crop&q=80', // Business success
      'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=1200&h=400&fit=crop&q=80', // Business planning
    ],
    quotes: [
      'Fuel your business growth with smart financing',
      'Your entrepreneurial spirit deserves support',
      'Scale your business to new heights',
      'Success is built on strong foundations',
      'Empowering entrepreneurs to achieve more',
      'Your business dreams are within reach',
      'Grow with confidence, backed by the right partner',
    ]
  },

  PARTNERSHIP: {
    images: [
      'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&h=400&fit=crop&q=80', // Partnership meeting
      'https://images.unsplash.com/photo-1600880292089-90a7e086ee0c?w=1200&h=400&fit=crop&q=80', // Business collaboration
      'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1200&h=400&fit=crop&q=80', // Team collaboration
      'https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=1200&h=400&fit=crop&q=80', // Partnership success
      'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=1200&h=400&fit=crop&q=80', // Business teamwork
    ],
    quotes: [
      'Together, we achieve extraordinary results',
      'Partnership multiplies success',
      'Collaborative growth, shared prosperity',
      'Stronger together, successful forever',
      'Your partnership deserves exceptional support',
      'Building success through collaboration',
      'United in vision, unstoppable in growth',
    ]
  },

  PRIVATE_LIMITED_COMPANY: {
    images: [
      'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&h=400&fit=crop&q=80', // Corporate building
      'https://images.unsplash.com/photo-1577415124269-fc1140a69e91?w=1200&h=400&fit=crop&q=80', // Modern corporate
      'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=1200&h=400&fit=crop&q=80', // Business excellence
      'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1200&h=400&fit=crop&q=80', // Corporate success
      'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&h=400&fit=crop&q=80', // Business analytics
    ],
    quotes: [
      'Excellence in corporate financing',
      'Empowering businesses to reach new heights',
      'Your corporate vision, our financial expertise',
      'Scaling businesses with strategic support',
      'Innovation meets financial excellence',
      'Building corporate success stories',
      'Your growth is our commitment',
    ]
  },

  PUBLIC_LIMITED_COMPANY: {
    images: [
      'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&h=400&fit=crop&q=80', // Corporate skyline
      'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=1200&h=400&fit=crop&q=80', // Business leadership
      'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=1200&h=400&fit=crop&q=80', // Corporate excellence
      'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=1200&h=400&fit=crop&q=80', // Business growth
      'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=1200&h=400&fit=crop&q=80', // Corporate professional
    ],
    quotes: [
      'Leading enterprises to greater success',
      'Enterprise-grade solutions for enterprise dreams',
      'Your ambition deserves premium support',
      'Scaling to new horizons together',
      'Excellence in every partnership',
      'Building legacies, one milestone at a time',
      'Strategic financing for strategic vision',
    ]
  },

  LLP: {
    images: [
      'https://images.unsplash.com/photo-1556740758-90de374c12ad?w=1200&h=400&fit=crop&q=80', // Professional team
      'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=1200&h=400&fit=crop&q=80', // Business collaboration
      'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=1200&h=400&fit=crop&q=80', // Professional success
      'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=1200&h=400&fit=crop&q=80', // Business professionals
      'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=1200&h=400&fit=crop&q=80', // Partnership work
    ],
    quotes: [
      'Professional excellence meets financial support',
      'Your partnership, our commitment',
      'Growing professional services together',
      'Expertise backed by the right financial partner',
      'Building successful professional ventures',
      'Your professional growth is our mission',
      'Partnership in growth, excellence in service',
    ]
  },

  DOCTOR: {
    images: [
      'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=1200&h=400&fit=crop&q=80', // Medical facility
      'https://images.unsplash.com/photo-1516549655169-df83a0774514?w=1200&h=400&fit=crop&q=80', // Healthcare
      'https://images.unsplash.com/photo-1538108149393-fbbd81895907?w=1200&h=400&fit=crop&q=80', // Medical excellence
      'https://images.unsplash.com/photo-1585421514738-01798e348b17?w=1200&h=400&fit=crop&q=80', // Healthcare professional
      'https://images.unsplash.com/photo-1579154204601-01588f351e67?w=1200&h=400&fit=crop&q=80', // Medical care
    ],
    quotes: [
      'Empowering healers to expand their practice',
      'Your dedication to care deserves support',
      'Building better healthcare, together',
      'Financing dreams of medical excellence',
      'Your healing hands, our financial backing',
      'Supporting those who save lives',
      'Healthcare excellence starts with the right partner',
    ]
  },

  LAWYER: {
    images: [
      'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=1200&h=400&fit=crop&q=80', // Legal library
      'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=1200&h=400&fit=crop&q=80', // Legal profession
      'https://images.unsplash.com/photo-1505664194779-8beaceb93744?w=1200&h=400&fit=crop&q=80', // Justice
      'https://images.unsplash.com/photo-1436450412740-6b988f486c6b?w=1200&h=400&fit=crop&q=80', // Legal work
      'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=1200&h=400&fit=crop&q=80', // Professional legal

    ],
    quotes: [
      'Justice seekers deserve financial justice too',
      'Your practice, our commitment',
      'Empowering legal professionals to excel',
      'Building strong practices with strong support',
      'Your dedication deserves the best',
      'Legal excellence backed by financial strength',
      'Supporting champions of justice',
    ]
  },

  PURE_RENTAL: {
    images: [
      'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1200&h=400&fit=crop&q=80', // Property investment
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&h=400&fit=crop&q=80', // Rental property
      'https://images.unsplash.com/photo-1582407947304-fd86f028f716?w=1200&h=400&fit=crop&q=80', // Real estate
      'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=1200&h=400&fit=crop&q=80', // Property portfolio
      'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=1200&h=400&fit=crop&q=80', // Investment property
    ],
    quotes: [
      'Building wealth through smart property investment',
      'Your rental income deserves optimization',
      'Grow your property portfolio with confidence',
      'Passive income, active support',
      'Maximizing returns on your investments',
      'Your property empire starts here',
      'Strategic financing for property investors',
    ]
  },

  AGRICULTURE: {
    images: [
      'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1200&h=400&fit=crop&q=80', // Agricultural land
      'https://images.unsplash.com/photo-1560493676-04071c5f467b?w=1200&h=400&fit=crop&q=80', // Farming
      'https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=1200&h=400&fit=crop&q=80', // Agriculture
      'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=1200&h=400&fit=crop&q=80', // Farm land
      'https://images.unsplash.com/photo-1523741543316-beb7fc7023d8?w=1200&h=400&fit=crop&q=80', // Agricultural growth
    ],
    quotes: [
      'Cultivating success, harvesting prosperity',
      'Your land, our commitment to your growth',
      'Nurturing agricultural excellence',
      'Sowing seeds of financial growth',
      'Supporting the backbone of our nation',
      'From field to fortune, we support you',
      'Growing together, succeeding together',
    ]
  },

  NRI: {
    images: [
      'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=1200&h=400&fit=crop&q=80', // Global connectivity
      'https://images.unsplash.com/photo-1569163139394-de4798aa62b6?w=1200&h=400&fit=crop&q=80', // International
      'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=1200&h=400&fit=crop&q=80', // World map
      'https://images.unsplash.com/photo-1488085061387-422e29b40080?w=1200&h=400&fit=crop&q=80', // Global business
      'https://images.unsplash.com/photo-1523821741446-edb2b68bb7a0?w=1200&h=400&fit=crop&q=80', // International travel
    ],
    quotes: [
      'Bridging continents, building dreams',
      'Your global aspirations, our local expertise',
      'Connecting hearts to home',
      'Distance is no barrier to your dreams',
      'Invest in India, invest in your roots',
      'Global citizens, local opportunities',
      'Making homecoming dreams a reality',
    ]
  },

  CHARTERED_ACCOUNTANT: {
    images: [
      'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=1200&h=400&fit=crop&q=80', // Financial analysis
      'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&h=400&fit=crop&q=80', // Accounting
      'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=1200&h=400&fit=crop&q=80', // Professional work
      'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&h=400&fit=crop&q=80', // Financial planning
      'https://images.unsplash.com/photo-1554224154-22dec7ec8818?w=1200&h=400&fit=crop&q=80', // Business finance
    ],
    quotes: [
      'Financial experts deserve financial excellence',
      'Your precision meets our perfection',
      'Building successful practices together',
      'Number crunchers, dream builders',
      'Excellence in accounting, excellence in service',
      'Your professional growth is our priority',
      'Strategic support for financial strategists',
    ]
  },

  COMPANY_SECRETARY: {
    images: [
      'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=1200&h=400&fit=crop&q=80', // Corporate governance
      'https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=1200&h=400&fit=crop&q=80', // Professional service
      'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=1200&h=400&fit=crop&q=80', // Corporate compliance
      'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=1200&h=400&fit=crop&q=80', // Professional excellence
      'https://images.unsplash.com/photo-1436450412740-6b988f486c6b?w=1200&h=400&fit=crop&q=80', // Corporate professional
    ],
    quotes: [
      'Compliance meets excellence',
      'Your professional expertise deserves support',
      'Building compliant, successful practices',
      'Governance excellence, financial strength',
      'Supporting the pillars of corporate governance',
      'Your dedication to compliance, our commitment to you',
      'Professional growth through strategic support',
    ]
  },

  HUF: {
    images: [
      'https://images.unsplash.com/photo-1511895426328-dc8714191300?w=1200&h=400&fit=crop&q=80', // Family unity
      'https://images.unsplash.com/photo-1609220136736-443140cffec6?w=1200&h=400&fit=crop&q=80', // Family heritage
      'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1200&h=400&fit=crop&q=80', // Family home
      'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?w=1200&h=400&fit=crop&q=80', // Family legacy
      'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=1200&h=400&fit=crop&q=80', // Family business
    ],
    quotes: [
      'Building family legacies, one generation at a time',
      'Your family\'s prosperity is our mission',
      'Strengthening family bonds through financial support',
      'Heritage meets modern financial solutions',
      'Family unity, financial prosperity',
      'Preserving traditions, building futures',
      'Your family\'s dreams, our commitment',
    ]
  },
}

/**
 * Get a random banner for login (image + quote)
 * Returns a different image and quote on each login
 */
export function getLoginBanner(subRole: string): { image: string; quote: string } | null {
  const config = CUSTOMER_BANNERS[subRole]
  if (!config) {
    return null
  }

  return {
    image: getRandomItem(config.images),
    quote: getRandomItem(config.quotes)
  }
}
