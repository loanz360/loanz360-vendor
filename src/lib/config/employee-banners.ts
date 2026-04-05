/**
 * Employee Dashboard Banner Configuration
 * Professional images from Unsplash with motivational quotes for each sub-role
 */

export interface BannerConfig {
  images: string[]
  quotes: string[]
}

interface EmployeeBannersConfig {
  [key: string]: BannerConfig
}

/**
 * Get a random item from an array
 */
const getRandomItem = <T,>(array: T[]): T => {
  return array[Math.floor(Math.random() * array.length)]
}

/**
 * Banner configurations for each employee sub-role
 * Images are professional, high-quality Unsplash photos relevant to each role
 */
export const EMPLOYEE_BANNERS: EmployeeBannersConfig = {
  CRO: {
    images: [
      'https://images.unsplash.com/photo-1556761175-b413da4baf72?w=1200&h=400&fit=crop&q=80', // Team collaboration
      'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&h=400&fit=crop&q=80', // Professional meeting
      'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=1200&h=400&fit=crop&q=80', // Customer service
      'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=1200&h=400&fit=crop&q=80', // Professional woman
      'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=1200&h=400&fit=crop&q=80', // Team working
    ],
    quotes: [
      'Building relationships that last a lifetime',
      'Your success is our commitment',
      'Excellence in every customer interaction',
      'Creating memorable customer experiences',
      'Trust is earned through exceptional service',
      'Empowering customers to achieve their dreams',
      'Every conversation is an opportunity to excel',
    ]
  },

  BUSINESS_DEVELOPMENT_EXECUTIVE: {
    images: [
      'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1200&h=400&fit=crop&q=80', // Business strategy
      'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&h=400&fit=crop&q=80', // Business analytics
      'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=1200&h=400&fit=crop&q=80', // Professional man
      'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=1200&h=400&fit=crop&q=80', // Business growth
      'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=1200&h=400&fit=crop&q=80', // Team discussion
    ],
    quotes: [
      'Every lead is a new opportunity waiting to unfold',
      'Success is built one partnership at a time',
      'Your drive today creates tomorrow\'s achievements',
      'Growth happens outside your comfort zone',
      'Transform prospects into lasting partnerships',
      'Innovation distinguishes leaders from followers',
      'Persistence turns opportunities into success',
    ]
  },

  BUSINESS_DEVELOPMENT_MANAGER: {
    images: [
      'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200&h=400&fit=crop&q=80', // Leadership
      'https://images.unsplash.com/photo-1542744094-24638eff58bb?w=1200&h=400&fit=crop&q=80', // Team leadership
      'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1200&h=400&fit=crop&q=80', // Strategy meeting
      'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&h=400&fit=crop&q=80', // Professional team
      'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=1200&h=400&fit=crop&q=80', // Business planning
    ],
    quotes: [
      'Great leaders inspire others to achieve greatness',
      'Your vision shapes the team\'s success',
      'Empower your team to exceed all expectations',
      'Strategic thinking creates extraordinary results',
      'Lead by example, inspire through action',
      'Success is a team effort, not a solo journey',
      'Transform challenges into opportunities for growth',
    ]
  },

  DIGITAL_SALES: {
    images: [
      'https://images.unsplash.com/photo-1551650975-87deedd944c3?w=1200&h=400&fit=crop&q=80', // Digital marketing
      'https://images.unsplash.com/photo-1533750349088-cd871a92f312?w=1200&h=400&fit=crop&q=80', // Tech workspace
      'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&h=400&fit=crop&q=80', // Digital analytics
      'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1200&h=400&fit=crop&q=80', // Online business
      'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=1200&h=400&fit=crop&q=80', // Digital work
    ],
    quotes: [
      'Digital innovation drives tomorrow\'s success',
      'Connect, engage, and convert with excellence',
      'Your clicks today build lasting relationships',
      'Master the digital landscape, dominate the market',
      'Every interaction is a chance to make an impact',
      'Data-driven decisions lead to remarkable results',
      'The future of sales is digital - embrace it',
    ]
  },

  CHANNEL_PARTNER_EXECUTIVE: {
    images: [
      'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&h=400&fit=crop&q=80', // Partnership meeting
      'https://images.unsplash.com/photo-1556761175-4b46a572b786?w=1200&h=400&fit=crop&q=80', // Collaboration
      'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=1200&h=400&fit=crop&q=80', // Professional handshake
      'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=1200&h=400&fit=crop&q=80', // Team collaboration
      'https://images.unsplash.com/photo-1573164713714-d95e436ab8d6?w=1200&h=400&fit=crop&q=80', // Business woman
    ],
    quotes: [
      'Strong partnerships create unlimited possibilities',
      'Your dedication strengthens every relationship',
      'Building bridges to mutual success',
      'Excellence in partnership management',
      'Together we achieve more than alone',
      'Nurture relationships, grow success',
      'Your network is your net worth',
    ]
  },

  CHANNEL_PARTNER_MANAGER: {
    images: [
      'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=1200&h=400&fit=crop&q=80', // Team strategy
      'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200&h=400&fit=crop&q=80', // Leadership team
      'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1200&h=400&fit=crop&q=80', // Team meeting
      'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=1200&h=400&fit=crop&q=80', // Business growth
      'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1200&h=400&fit=crop&q=80', // Strategy planning
    ],
    quotes: [
      'Lead your partners to unprecedented success',
      'Strategic partnerships drive exponential growth',
      'Your leadership shapes the future of partnerships',
      'Empower partners, multiply success',
      'Great managers build great partner networks',
      'Vision, strategy, and execution create excellence',
      'Transform partnerships into powerhouses',
    ]
  },

  FINANCE_EXECUTIVE: {
    images: [
      'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=1200&h=400&fit=crop&q=80', // Finance charts
      'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&h=400&fit=crop&q=80', // Financial data
      'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&h=400&fit=crop&q=80', // Financial analysis
      'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=1200&h=400&fit=crop&q=80', // Finance workspace
      'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=1200&h=400&fit=crop&q=80', // Business finance
    ],
    quotes: [
      'Precision in numbers, excellence in service',
      'Your accuracy builds financial confidence',
      'Every transaction tells a story of success',
      'Financial excellence drives business growth',
      'Attention to detail creates lasting value',
      'Numbers never lie - let them guide success',
      'Your diligence ensures financial integrity',
    ]
  },

  ACCOUNTS_EXECUTIVE: {
    images: [
      'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=1200&h=400&fit=crop&q=80', // Accounting work
      'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=1200&h=400&fit=crop&q=80', // Financial planning
      'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&h=400&fit=crop&q=80', // Data analysis
      'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=1200&h=400&fit=crop&q=80', // Office finance
      'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=1200&h=400&fit=crop&q=80', // Professional work
    ],
    quotes: [
      'Accuracy and integrity in every entry',
      'Your precision powers business success',
      'Excellence in accounting, excellence in results',
      'Every number counts towards greater goals',
      'Meticulous work creates financial clarity',
      'Your dedication ensures accurate records',
      'Balance the books, balance success',
    ]
  },

  ACCOUNTS_MANAGER: {
    images: [
      'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=1200&h=400&fit=crop&q=80', // Financial management
      'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=1200&h=400&fit=crop&q=80', // Team management
      'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&h=400&fit=crop&q=80', // Financial strategy
      'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200&h=400&fit=crop&q=80', // Leadership
      'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=1200&h=400&fit=crop&q=80', // Financial oversight
    ],
    quotes: [
      'Lead with integrity, manage with precision',
      'Your oversight ensures financial excellence',
      'Strategic financial management drives growth',
      'Empower your team to achieve accuracy',
      'Financial leadership creates business stability',
      'Guide your team to new heights of excellence',
      'Your vision shapes financial success',
    ]
  },

  DIRECT_SALES_EXECUTIVE: {
    images: [
      'https://images.unsplash.com/photo-1556761175-4b46a572b786?w=1200&h=400&fit=crop&q=80', // Sales meeting
      'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=1200&h=400&fit=crop&q=80', // Handshake deal
      'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=1200&h=400&fit=crop&q=80', // Professional sales
      'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=1200&h=400&fit=crop&q=80', // Business meeting
      'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=1200&h=400&fit=crop&q=80', // Professional work
    ],
    quotes: [
      'Every conversation is an opportunity to win',
      'Your passion drives sales success',
      'Close deals, open opportunities',
      'Persistence and excellence lead to success',
      'Build trust, deliver results',
      'Your energy creates momentum',
      'Success loves preparation and enthusiasm',
    ]
  },

  DIRECT_SALES_MANAGER: {
    images: [
      'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=1200&h=400&fit=crop&q=80', // Sales team
      'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200&h=400&fit=crop&q=80', // Team leadership
      'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1200&h=400&fit=crop&q=80', // Leadership meeting
      'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=1200&h=400&fit=crop&q=80', // Growth strategy
      'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1200&h=400&fit=crop&q=80', // Strategic planning
    ],
    quotes: [
      'Lead your team to exceed every target',
      'Great managers create great salespeople',
      'Your leadership drives team success',
      'Inspire, motivate, and achieve together',
      'Build a team that sells with excellence',
      'Strategic leadership creates sales champions',
      'Empower your team to break records',
    ]
  },

  TELE_SALES: {
    images: [
      'https://images.unsplash.com/photo-1556761175-4b46a572b786?w=1200&h=400&fit=crop&q=80', // Sales interaction
      'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=1200&h=400&fit=crop&q=80', // Professional meeting
      'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=1200&h=400&fit=crop&q=80', // Sales professional
      'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=1200&h=400&fit=crop&q=80', // Deal closing
      'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=1200&h=400&fit=crop&q=80', // Professional agent
    ],
    quotes: [
      'Your hustle today builds tomorrow\'s success',
      'Every \'no\' brings you closer to \'yes\'',
      'Be the solution your customers need',
      'Consistent effort creates consistent results',
      'Your attitude determines your altitude',
      'Success is earned through dedication',
      'Make every interaction count',
    ]
  },

  PARTNER_SUPPORT_EXECUTIVE: {
    images: [
      'https://images.unsplash.com/photo-1556761175-b413da4baf72?w=1200&h=400&fit=crop&q=80', // Support team
      'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=1200&h=400&fit=crop&q=80', // Customer service
      'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&h=400&fit=crop&q=80', // Professional meeting
      'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=1200&h=400&fit=crop&q=80', // Handshake
      'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=1200&h=400&fit=crop&q=80', // Professional support
    ],
    quotes: [
      'Every partner issue is a chance to strengthen relationships',
      'Your support builds lasting partnerships',
      'Excellence in every ticket resolution',
      'Partners succeed when we succeed together',
      'Swift resolution, lasting satisfaction',
      'Your dedication makes partners confident',
      'Building trust through exceptional support',
    ]
  },

  PARTNER_SUPPORT_MANAGER: {
    images: [
      'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200&h=400&fit=crop&q=80', // Leadership team
      'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=1200&h=400&fit=crop&q=80', // Team strategy
      'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1200&h=400&fit=crop&q=80', // Team meeting
      'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&h=400&fit=crop&q=80', // Professional meeting
      'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1200&h=400&fit=crop&q=80', // Strategy planning
    ],
    quotes: [
      'Lead your team to deliver exceptional support',
      'Great support leadership creates partner loyalty',
      'Your vision shapes partner satisfaction',
      'Empower your team to exceed SLA targets',
      'Strategic support management drives success',
      'Guide your team to support excellence',
      'Partners trust leaders who deliver results',
    ]
  },

  TECHNICAL_SUPPORT_EXECUTIVE: {
    images: [
      'https://images.unsplash.com/photo-1551033406-611cf9a28f67?w=1200&h=400&fit=crop&q=80', // Tech support
      'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&h=400&fit=crop&q=80', // Server room
      'https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=1200&h=400&fit=crop&q=80', // Coding
      'https://images.unsplash.com/photo-1537432376149-e84978a29b0d?w=1200&h=400&fit=crop&q=80', // Tech workspace
      'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200&h=400&fit=crop&q=80', // IT support
    ],
    quotes: [
      'Every bug fixed is a user experience improved',
      'Technical excellence powers business success',
      'Your expertise solves the impossible',
      'From bugs to breakthroughs - you make it happen',
      'Code today, innovate tomorrow',
      'Technical support that exceeds expectations',
      'Your solutions keep the system running',
    ]
  },

  CUSTOMER_SUPPORT_EXECUTIVE: {
    images: [
      'https://images.unsplash.com/photo-1556761175-b413da4baf72?w=1200&h=400&fit=crop&q=80', // Support team
      'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=1200&h=400&fit=crop&q=80', // Customer service
      'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&h=400&fit=crop&q=80', // Professional meeting
      'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=1200&h=400&fit=crop&q=80', // Professional woman
      'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=1200&h=400&fit=crop&q=80', // Team collaboration
    ],
    quotes: [
      'Every customer interaction matters',
      'Your care creates loyal customers',
      'Excellence in customer service, always',
      'Turning complaints into compliments',
      'Customer happiness is your success',
      'Your support makes all the difference',
      'Building relationships one ticket at a time',
    ]
  },

  COMPLIANCE_OFFICER: {
    images: [
      'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=1200&h=400&fit=crop&q=80', // Legal work
      'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=1200&h=400&fit=crop&q=80', // Professional handshake
      'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=1200&h=400&fit=crop&q=80', // Financial charts
      'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=1200&h=400&fit=crop&q=80', // Professional
      'https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=1200&h=400&fit=crop&q=80', // Office professional
    ],
    quotes: [
      'Integrity is the foundation of compliance',
      'Your vigilance protects the organization',
      'Excellence in regulatory adherence',
      'Compliance today, confidence tomorrow',
      'Your diligence ensures trust and integrity',
      'Protecting the business through careful oversight',
      'Risk management that enables growth',
    ]
  },

  HR: {
    images: [
      'https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=1200&h=400&fit=crop&q=80', // HR team
      'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=1200&h=400&fit=crop&q=80', // Team collaboration
      'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&h=400&fit=crop&q=80', // Professional meeting
      'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=1200&h=400&fit=crop&q=80', // HR professional
      'https://images.unsplash.com/photo-1556761175-4b46a572b786?w=1200&h=400&fit=crop&q=80', // Onboarding
    ],
    quotes: [
      'Building great teams, one hire at a time',
      'Your care creates a thriving workplace',
      'People are our greatest asset',
      'HR excellence drives company culture',
      'Your support empowers every employee',
      'Creating a workplace where talent thrives',
      'Nurturing talent, building futures',
    ]
  }
}

/**
 * Get a random banner configuration for a specific sub-role
 */
export const getRandomBanner = (subRole: string): { image: string; quote: string } => {
  const config = EMPLOYEE_BANNERS[subRole]

  // Fallback to default if sub-role not found
  if (!config) {
    return {
      image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&h=400&fit=crop&q=80',
      quote: 'Excellence is not a skill, it\'s an attitude'
    }
  }

  return {
    image: getRandomItem(config.images),
    quote: getRandomItem(config.quotes)
  }
}

/**
 * Get banner configuration on each login
 * This ensures a fresh banner every time the user logs in
 */
export const getLoginBanner = (subRole: string): { image: string; quote: string } => {
  return getRandomBanner(subRole)
}
