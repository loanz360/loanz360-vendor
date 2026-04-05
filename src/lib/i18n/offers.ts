/**
 * Multi-language support for Offers to Customers module
 * Supports: English (en), Hindi (hi), Tamil (ta), Telugu (te), Kannada (kn), Malayalam (ml), Marathi (mr), Bengali (bn), Gujarati (gu)
 */

export type SupportedLanguage = 'en' | 'hi' | 'ta' | 'te' | 'kn' | 'ml' | 'mr' | 'bn' | 'gu'

export const SUPPORTED_LANGUAGES: { code: SupportedLanguage; name: string; nativeName: string }[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી' }
]

export interface OffersTranslations {
  // Page titles
  pageTitle: string
  pageSubtitle: string
  manageOffers: string

  // Navigation tabs
  activeOffers: string
  expiredOffers: string
  draftOffers: string
  scheduledOffers: string

  // Actions
  createOffer: string
  editOffer: string
  deleteOffer: string
  shareOffer: string
  viewDetails: string
  addToFavorites: string
  removeFromFavorites: string
  copyLink: string
  downloadImage: string

  // Sharing
  shareViaWhatsApp: string
  shareViaSMS: string
  shareViaEmail: string
  copyToClipboard: string
  linkCopied: string

  // Form labels
  offerTitle: string
  description: string
  bankNbfc: string
  selectBank: string
  statesApplicable: string
  selectStates: string
  allIndia: string
  startDate: string
  endDate: string
  offerImage: string
  uploadImage: string
  generateWithAI: string
  schedulePublish: string
  timezone: string

  // Status
  active: string
  expired: string
  draft: string
  scheduled: string

  // Search & Filter
  searchOffers: string
  searchPlaceholder: string
  filterByBank: string
  filterByState: string
  sortBy: string
  sortRecent: string
  sortPopular: string
  sortRecommended: string
  clearFilters: string
  noResults: string

  // Stats
  totalOffers: string
  myShares: string
  myConversions: string
  trending: string
  viewsToday: string

  // Messages
  offerCreated: string
  offerUpdated: string
  offerDeleted: string
  confirmDelete: string
  loadingOffers: string
  errorLoading: string
  retry: string
  noOffersAvailable: string

  // Dates
  validFrom: string
  validUntil: string
  expiresOn: string
  publishAt: string

  // Common
  cancel: string
  save: string
  submit: string
  close: string
  back: string
  next: string
  previous: string
  loading: string
  selected: string
  selectAll: string
  clearSelection: string
}

export const translations: Record<SupportedLanguage, OffersTranslations> = {
  en: {
    pageTitle: 'Offers to Customers',
    pageSubtitle: 'Browse and share exclusive bank and NBFC offers',
    manageOffers: 'Manage Offers',

    activeOffers: 'Active Offers',
    expiredOffers: 'Expired',
    draftOffers: 'Drafts',
    scheduledOffers: 'Scheduled',

    createOffer: 'Create Offer',
    editOffer: 'Edit Offer',
    deleteOffer: 'Delete Offer',
    shareOffer: 'Share Offer',
    viewDetails: 'View Details',
    addToFavorites: 'Add to Favorites',
    removeFromFavorites: 'Remove from Favorites',
    copyLink: 'Copy Link',
    downloadImage: 'Download Image',

    shareViaWhatsApp: 'Share via WhatsApp',
    shareViaSMS: 'Share via SMS',
    shareViaEmail: 'Share via Email',
    copyToClipboard: 'Copy to Clipboard',
    linkCopied: 'Link copied!',

    offerTitle: 'Offer Title',
    description: 'Description',
    bankNbfc: 'Bank/NBFC',
    selectBank: 'Select Bank/NBFC',
    statesApplicable: 'States Applicable',
    selectStates: 'Select States',
    allIndia: 'All India',
    startDate: 'Start Date',
    endDate: 'End Date',
    offerImage: 'Offer Image',
    uploadImage: 'Upload Image',
    generateWithAI: 'Generate with AI',
    schedulePublish: 'Schedule Publishing',
    timezone: 'Timezone',

    active: 'Active',
    expired: 'Expired',
    draft: 'Draft',
    scheduled: 'Scheduled',

    searchOffers: 'Search Offers',
    searchPlaceholder: 'Search by title, bank, or description...',
    filterByBank: 'Filter by Bank',
    filterByState: 'Filter by State',
    sortBy: 'Sort By',
    sortRecent: 'Most Recent',
    sortPopular: 'Most Popular',
    sortRecommended: 'Recommended',
    clearFilters: 'Clear Filters',
    noResults: 'No offers match your search',

    totalOffers: 'Total Offers',
    myShares: 'My Shares',
    myConversions: 'Conversions',
    trending: 'Trending',
    viewsToday: 'Views Today',

    offerCreated: 'Offer created successfully!',
    offerUpdated: 'Offer updated successfully!',
    offerDeleted: 'Offer deleted successfully!',
    confirmDelete: 'Are you sure you want to delete this offer?',
    loadingOffers: 'Loading offers...',
    errorLoading: 'Error loading offers. Please try again.',
    retry: 'Retry',
    noOffersAvailable: 'No offers available at the moment.',

    validFrom: 'Valid From',
    validUntil: 'Valid Until',
    expiresOn: 'Expires On',
    publishAt: 'Publish At',

    cancel: 'Cancel',
    save: 'Save',
    submit: 'Submit',
    close: 'Close',
    back: 'Back',
    next: 'Next',
    previous: 'Previous',
    loading: 'Loading...',
    selected: 'selected',
    selectAll: 'Select All',
    clearSelection: 'Clear Selection'
  },

  hi: {
    pageTitle: 'ग्राहकों के लिए ऑफर',
    pageSubtitle: 'बैंक और NBFC के विशेष ऑफर ब्राउज़ करें और साझा करें',
    manageOffers: 'ऑफर प्रबंधित करें',

    activeOffers: 'सक्रिय ऑफर',
    expiredOffers: 'समाप्त',
    draftOffers: 'ड्राफ्ट',
    scheduledOffers: 'निर्धारित',

    createOffer: 'ऑफर बनाएं',
    editOffer: 'ऑफर संपादित करें',
    deleteOffer: 'ऑफर हटाएं',
    shareOffer: 'ऑफर साझा करें',
    viewDetails: 'विवरण देखें',
    addToFavorites: 'पसंदीदा में जोड़ें',
    removeFromFavorites: 'पसंदीदा से हटाएं',
    copyLink: 'लिंक कॉपी करें',
    downloadImage: 'छवि डाउनलोड करें',

    shareViaWhatsApp: 'WhatsApp पर साझा करें',
    shareViaSMS: 'SMS पर साझा करें',
    shareViaEmail: 'ईमेल पर साझा करें',
    copyToClipboard: 'क्लिपबोर्ड पर कॉपी करें',
    linkCopied: 'लिंक कॉपी हो गया!',

    offerTitle: 'ऑफर शीर्षक',
    description: 'विवरण',
    bankNbfc: 'बैंक/NBFC',
    selectBank: 'बैंक/NBFC चुनें',
    statesApplicable: 'लागू राज्य',
    selectStates: 'राज्य चुनें',
    allIndia: 'संपूर्ण भारत',
    startDate: 'प्रारंभ तिथि',
    endDate: 'समाप्ति तिथि',
    offerImage: 'ऑफर छवि',
    uploadImage: 'छवि अपलोड करें',
    generateWithAI: 'AI से बनाएं',
    schedulePublish: 'प्रकाशन निर्धारित करें',
    timezone: 'समय क्षेत्र',

    active: 'सक्रिय',
    expired: 'समाप्त',
    draft: 'ड्राफ्ट',
    scheduled: 'निर्धारित',

    searchOffers: 'ऑफर खोजें',
    searchPlaceholder: 'शीर्षक, बैंक या विवरण से खोजें...',
    filterByBank: 'बैंक से फ़िल्टर करें',
    filterByState: 'राज्य से फ़िल्टर करें',
    sortBy: 'क्रमबद्ध करें',
    sortRecent: 'सबसे हाल का',
    sortPopular: 'सबसे लोकप्रिय',
    sortRecommended: 'अनुशंसित',
    clearFilters: 'फ़िल्टर साफ़ करें',
    noResults: 'कोई ऑफर आपकी खोज से मेल नहीं खाता',

    totalOffers: 'कुल ऑफर',
    myShares: 'मेरे शेयर',
    myConversions: 'रूपांतरण',
    trending: 'ट्रेंडिंग',
    viewsToday: 'आज के व्यूज',

    offerCreated: 'ऑफर सफलतापूर्वक बनाया गया!',
    offerUpdated: 'ऑफर सफलतापूर्वक अपडेट किया गया!',
    offerDeleted: 'ऑफर सफलतापूर्वक हटाया गया!',
    confirmDelete: 'क्या आप वाकई इस ऑफर को हटाना चाहते हैं?',
    loadingOffers: 'ऑफर लोड हो रहे हैं...',
    errorLoading: 'ऑफर लोड करने में त्रुटि। कृपया पुनः प्रयास करें।',
    retry: 'पुनः प्रयास करें',
    noOffersAvailable: 'इस समय कोई ऑफर उपलब्ध नहीं है।',

    validFrom: 'से मान्य',
    validUntil: 'तक मान्य',
    expiresOn: 'समाप्ति',
    publishAt: 'प्रकाशन समय',

    cancel: 'रद्द करें',
    save: 'सहेजें',
    submit: 'जमा करें',
    close: 'बंद करें',
    back: 'वापस',
    next: 'अगला',
    previous: 'पिछला',
    loading: 'लोड हो रहा है...',
    selected: 'चयनित',
    selectAll: 'सभी चुनें',
    clearSelection: 'चयन साफ़ करें'
  },

  ta: {
    pageTitle: 'வாடிக்கையாளர்களுக்கான சலுகைகள்',
    pageSubtitle: 'வங்கி மற்றும் NBFC சலுகைகளை பார்வையிடவும் பகிரவும்',
    manageOffers: 'சலுகைகளை நிர்வகிக்கவும்',

    activeOffers: 'செயலில் உள்ள சலுகைகள்',
    expiredOffers: 'காலாவதியானவை',
    draftOffers: 'வரைவுகள்',
    scheduledOffers: 'திட்டமிடப்பட்டவை',

    createOffer: 'சலுகை உருவாக்கு',
    editOffer: 'சலுகை திருத்து',
    deleteOffer: 'சலுகை நீக்கு',
    shareOffer: 'சலுகை பகிர்',
    viewDetails: 'விவரங்கள் காண்க',
    addToFavorites: 'பிடித்தவற்றில் சேர்',
    removeFromFavorites: 'பிடித்தவற்றிலிருந்து நீக்கு',
    copyLink: 'இணைப்பை நகலெடு',
    downloadImage: 'படத்தை பதிவிறக்கு',

    shareViaWhatsApp: 'WhatsApp வழியாக பகிர்',
    shareViaSMS: 'SMS வழியாக பகிர்',
    shareViaEmail: 'மின்னஞ்சல் வழியாக பகிர்',
    copyToClipboard: 'கிளிப்போர்டில் நகலெடு',
    linkCopied: 'இணைப்பு நகலெடுக்கப்பட்டது!',

    offerTitle: 'சலுகை தலைப்பு',
    description: 'விளக்கம்',
    bankNbfc: 'வங்கி/NBFC',
    selectBank: 'வங்கி/NBFC தேர்வு செய்க',
    statesApplicable: 'பொருந்தும் மாநிலங்கள்',
    selectStates: 'மாநிலங்களை தேர்வு செய்க',
    allIndia: 'அனைத்து இந்தியா',
    startDate: 'தொடக்க தேதி',
    endDate: 'முடிவு தேதி',
    offerImage: 'சலுகை படம்',
    uploadImage: 'படம் பதிவேற்று',
    generateWithAI: 'AI மூலம் உருவாக்கு',
    schedulePublish: 'வெளியீட்டை திட்டமிடு',
    timezone: 'நேர மண்டலம்',

    active: 'செயலில்',
    expired: 'காலாவதி',
    draft: 'வரைவு',
    scheduled: 'திட்டமிடப்பட்டது',

    searchOffers: 'சலுகைகளை தேடு',
    searchPlaceholder: 'தலைப்பு, வங்கி அல்லது விளக்கத்தால் தேடு...',
    filterByBank: 'வங்கியால் வடிகட்டு',
    filterByState: 'மாநிலத்தால் வடிகட்டு',
    sortBy: 'வரிசைப்படுத்து',
    sortRecent: 'சமீபத்தியது',
    sortPopular: 'பிரபலமானது',
    sortRecommended: 'பரிந்துரைக்கப்பட்டது',
    clearFilters: 'வடிகட்டிகளை அழி',
    noResults: 'உங்கள் தேடலுக்கு சலுகைகள் இல்லை',

    totalOffers: 'மொத்த சலுகைகள்',
    myShares: 'என் பகிர்வுகள்',
    myConversions: 'மாற்றங்கள்',
    trending: 'பிரபலமானவை',
    viewsToday: 'இன்றைய பார்வைகள்',

    offerCreated: 'சலுகை வெற்றிகரமாக உருவாக்கப்பட்டது!',
    offerUpdated: 'சலுகை வெற்றிகரமாக புதுப்பிக்கப்பட்டது!',
    offerDeleted: 'சலுகை வெற்றிகரமாக நீக்கப்பட்டது!',
    confirmDelete: 'இந்த சலுகையை நீக்க விரும்புகிறீர்களா?',
    loadingOffers: 'சலுகைகள் ஏற்றப்படுகின்றன...',
    errorLoading: 'சலுகைகளை ஏற்றுவதில் பிழை. மீண்டும் முயற்சிக்கவும்.',
    retry: 'மீண்டும் முயற்சி',
    noOffersAvailable: 'தற்போது சலுகைகள் இல்லை.',

    validFrom: 'இருந்து செல்லுபடியாகும்',
    validUntil: 'வரை செல்லுபடியாகும்',
    expiresOn: 'காலாவதியாகும் தேதி',
    publishAt: 'வெளியிடும் நேரம்',

    cancel: 'ரத்து செய்',
    save: 'சேமி',
    submit: 'சமர்ப்பி',
    close: 'மூடு',
    back: 'பின்',
    next: 'அடுத்து',
    previous: 'முந்தைய',
    loading: 'ஏற்றுகிறது...',
    selected: 'தேர்ந்தெடுக்கப்பட்டது',
    selectAll: 'அனைத்தையும் தேர்வு செய்',
    clearSelection: 'தேர்வை அழி'
  },

  // Telugu translations
  te: {
    pageTitle: 'కస్టమర్లకు ఆఫర్లు',
    pageSubtitle: 'బ్యాంక్ మరియు NBFC ఆఫర్లను బ్రౌజ్ చేయండి మరియు షేర్ చేయండి',
    manageOffers: 'ఆఫర్లను నిర్వహించండి',
    activeOffers: 'యాక్టివ్ ఆఫర్లు',
    expiredOffers: 'ముగిసినవి',
    draftOffers: 'డ్రాఫ్ట్‌లు',
    scheduledOffers: 'షెడ్యూల్ చేసినవి',
    createOffer: 'ఆఫర్ సృష్టించండి',
    editOffer: 'ఆఫర్ సవరించండి',
    deleteOffer: 'ఆఫర్ తొలగించండి',
    shareOffer: 'ఆఫర్ షేర్ చేయండి',
    viewDetails: 'వివరాలు చూడండి',
    addToFavorites: 'ఫేవరిట్‌లకు జోడించండి',
    removeFromFavorites: 'ఫేవరిట్‌ల నుండి తొలగించండి',
    copyLink: 'లింక్ కాపీ చేయండి',
    downloadImage: 'చిత్రం డౌన్‌లోడ్ చేయండి',
    shareViaWhatsApp: 'WhatsApp ద్వారా షేర్ చేయండి',
    shareViaSMS: 'SMS ద్వారా షేర్ చేయండి',
    shareViaEmail: 'ఇమెయిల్ ద్వారా షేర్ చేయండి',
    copyToClipboard: 'క్లిప్‌బోర్డ్‌కు కాపీ చేయండి',
    linkCopied: 'లింక్ కాపీ చేయబడింది!',
    offerTitle: 'ఆఫర్ శీర్షిక',
    description: 'వివరణ',
    bankNbfc: 'బ్యాంక్/NBFC',
    selectBank: 'బ్యాంక్/NBFC ఎంచుకోండి',
    statesApplicable: 'వర్తించే రాష్ట్రాలు',
    selectStates: 'రాష్ట్రాలు ఎంచుకోండి',
    allIndia: 'మొత్తం భారతదేశం',
    startDate: 'ప్రారంభ తేదీ',
    endDate: 'ముగింపు తేదీ',
    offerImage: 'ఆఫర్ చిత్రం',
    uploadImage: 'చిత్రం అప్‌లోడ్ చేయండి',
    generateWithAI: 'AI తో సృష్టించండి',
    schedulePublish: 'ప్రచురణ షెడ్యూల్ చేయండి',
    timezone: 'టైమ్‌జోన్',
    active: 'యాక్టివ్',
    expired: 'ముగిసింది',
    draft: 'డ్రాఫ్ట్',
    scheduled: 'షెడ్యూల్ చేయబడింది',
    searchOffers: 'ఆఫర్లు శోధించండి',
    searchPlaceholder: 'శీర్షిక, బ్యాంక్ లేదా వివరణ ద్వారా శోధించండి...',
    filterByBank: 'బ్యాంక్ ద్వారా ఫిల్టర్ చేయండి',
    filterByState: 'రాష్ట్రం ద్వారా ఫిల్టర్ చేయండి',
    sortBy: 'క్రమబద్ధీకరించు',
    sortRecent: 'ఇటీవలిది',
    sortPopular: 'ప్రసిద్ధమైనది',
    sortRecommended: 'సిఫార్సు చేసినది',
    clearFilters: 'ఫిల్టర్లు క్లియర్ చేయండి',
    noResults: 'మీ శోధనకు ఆఫర్లు లేవు',
    totalOffers: 'మొత్తం ఆఫర్లు',
    myShares: 'నా షేర్లు',
    myConversions: 'మార్పిడులు',
    trending: 'ట్రెండింగ్',
    viewsToday: 'ఈ రోజు వీక్షణలు',
    offerCreated: 'ఆఫర్ విజయవంతంగా సృష్టించబడింది!',
    offerUpdated: 'ఆఫర్ విజయవంతంగా నవీకరించబడింది!',
    offerDeleted: 'ఆఫర్ విజయవంతంగా తొలగించబడింది!',
    confirmDelete: 'ఈ ఆఫర్‌ను తొలగించాలనుకుంటున్నారా?',
    loadingOffers: 'ఆఫర్లు లోడ్ అవుతున్నాయి...',
    errorLoading: 'ఆఫర్లు లోడ్ చేయడంలో లోపం. దయచేసి మళ్ళీ ప్రయత్నించండి.',
    retry: 'మళ్ళీ ప్రయత్నించండి',
    noOffersAvailable: 'ప్రస్తుతం ఆఫర్లు అందుబాటులో లేవు.',
    validFrom: 'నుండి చెల్లుతుంది',
    validUntil: 'వరకు చెల్లుతుంది',
    expiresOn: 'ముగుస్తుంది',
    publishAt: 'ప్రచురణ సమయం',
    cancel: 'రద్దు చేయండి',
    save: 'సేవ్ చేయండి',
    submit: 'సమర్పించండి',
    close: 'మూసివేయండి',
    back: 'వెనుకకు',
    next: 'తదుపరి',
    previous: 'మునుపటి',
    loading: 'లోడ్ అవుతోంది...',
    selected: 'ఎంచుకోబడింది',
    selectAll: 'అన్నీ ఎంచుకోండి',
    clearSelection: 'ఎంపిక క్లియర్ చేయండి'
  },

  // Kannada translations (abbreviated for space)
  kn: {
    pageTitle: 'ಗ್ರಾಹಕರಿಗೆ ಆಫರ್‌ಗಳು',
    pageSubtitle: 'ಬ್ಯಾಂಕ್ ಮತ್ತು NBFC ಆಫರ್‌ಗಳನ್ನು ಬ್ರೌಸ್ ಮಾಡಿ ಮತ್ತು ಹಂಚಿಕೊಳ್ಳಿ',
    manageOffers: 'ಆಫರ್‌ಗಳನ್ನು ನಿರ್ವಹಿಸಿ',
    activeOffers: 'ಸಕ್ರಿಯ ಆಫರ್‌ಗಳು',
    expiredOffers: 'ಅವಧಿ ಮುಗಿದವು',
    draftOffers: 'ಕರಡುಗಳು',
    scheduledOffers: 'ನಿಗದಿಪಡಿಸಲಾಗಿದೆ',
    createOffer: 'ಆಫರ್ ರಚಿಸಿ',
    editOffer: 'ಆಫರ್ ಸಂಪಾದಿಸಿ',
    deleteOffer: 'ಆಫರ್ ಅಳಿಸಿ',
    shareOffer: 'ಆಫರ್ ಹಂಚಿಕೊಳ್ಳಿ',
    viewDetails: 'ವಿವರಗಳನ್ನು ವೀಕ್ಷಿಸಿ',
    addToFavorites: 'ಮೆಚ್ಚಿನವುಗಳಿಗೆ ಸೇರಿಸಿ',
    removeFromFavorites: 'ಮೆಚ್ಚಿನವುಗಳಿಂದ ತೆಗೆದುಹಾಕಿ',
    copyLink: 'ಲಿಂಕ್ ನಕಲಿಸಿ',
    downloadImage: 'ಚಿತ್ರ ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ',
    shareViaWhatsApp: 'WhatsApp ಮೂಲಕ ಹಂಚಿಕೊಳ್ಳಿ',
    shareViaSMS: 'SMS ಮೂಲಕ ಹಂಚಿಕೊಳ್ಳಿ',
    shareViaEmail: 'ಇಮೇಲ್ ಮೂಲಕ ಹಂಚಿಕೊಳ್ಳಿ',
    copyToClipboard: 'ಕ್ಲಿಪ್‌ಬೋರ್ಡ್‌ಗೆ ನಕಲಿಸಿ',
    linkCopied: 'ಲಿಂಕ್ ನಕಲಿಸಲಾಗಿದೆ!',
    offerTitle: 'ಆಫರ್ ಶೀರ್ಷಿಕೆ',
    description: 'ವಿವರಣೆ',
    bankNbfc: 'ಬ್ಯಾಂಕ್/NBFC',
    selectBank: 'ಬ್ಯಾಂಕ್/NBFC ಆಯ್ಕೆಮಾಡಿ',
    statesApplicable: 'ಅನ್ವಯಿಸುವ ರಾಜ್ಯಗಳು',
    selectStates: 'ರಾಜ್ಯಗಳನ್ನು ಆಯ್ಕೆಮಾಡಿ',
    allIndia: 'ಎಲ್ಲಾ ಭಾರತ',
    startDate: 'ಪ್ರಾರಂಭ ದಿನಾಂಕ',
    endDate: 'ಅಂತಿಮ ದಿನಾಂಕ',
    offerImage: 'ಆಫರ್ ಚಿತ್ರ',
    uploadImage: 'ಚಿತ್ರ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ',
    generateWithAI: 'AI ಯೊಂದಿಗೆ ರಚಿಸಿ',
    schedulePublish: 'ಪ್ರಕಟಣೆ ನಿಗದಿಪಡಿಸಿ',
    timezone: 'ಸಮಯ ವಲಯ',
    active: 'ಸಕ್ರಿಯ',
    expired: 'ಅವಧಿ ಮುಗಿದಿದೆ',
    draft: 'ಕರಡು',
    scheduled: 'ನಿಗದಿಪಡಿಸಲಾಗಿದೆ',
    searchOffers: 'ಆಫರ್‌ಗಳನ್ನು ಹುಡುಕಿ',
    searchPlaceholder: 'ಶೀರ್ಷಿಕೆ, ಬ್ಯಾಂಕ್ ಅಥವಾ ವಿವರಣೆಯಿಂದ ಹುಡುಕಿ...',
    filterByBank: 'ಬ್ಯಾಂಕ್ ಮೂಲಕ ಫಿಲ್ಟರ್ ಮಾಡಿ',
    filterByState: 'ರಾಜ್ಯದಿಂದ ಫಿಲ್ಟರ್ ಮಾಡಿ',
    sortBy: 'ವಿಂಗಡಿಸು',
    sortRecent: 'ಇತ್ತೀಚಿನ',
    sortPopular: 'ಜನಪ್ರಿಯ',
    sortRecommended: 'ಶಿಫಾರಸು',
    clearFilters: 'ಫಿಲ್ಟರ್‌ಗಳನ್ನು ತೆರವುಗೊಳಿಸಿ',
    noResults: 'ನಿಮ್ಮ ಹುಡುಕಾಟಕ್ಕೆ ಆಫರ್‌ಗಳಿಲ್ಲ',
    totalOffers: 'ಒಟ್ಟು ಆಫರ್‌ಗಳು',
    myShares: 'ನನ್ನ ಹಂಚಿಕೆಗಳು',
    myConversions: 'ಪರಿವರ್ತನೆಗಳು',
    trending: 'ಟ್ರೆಂಡಿಂಗ್',
    viewsToday: 'ಇಂದಿನ ವೀಕ್ಷಣೆಗಳು',
    offerCreated: 'ಆಫರ್ ಯಶಸ್ವಿಯಾಗಿ ರಚಿಸಲಾಗಿದೆ!',
    offerUpdated: 'ಆಫರ್ ಯಶಸ್ವಿಯಾಗಿ ನವೀಕರಿಸಲಾಗಿದೆ!',
    offerDeleted: 'ಆಫರ್ ಯಶಸ್ವಿಯಾಗಿ ಅಳಿಸಲಾಗಿದೆ!',
    confirmDelete: 'ಈ ಆಫರ್ ಅನ್ನು ಅಳಿಸಲು ಖಚಿತವಾಗಿದ್ದೀರಾ?',
    loadingOffers: 'ಆಫರ್‌ಗಳನ್ನು ಲೋಡ್ ಮಾಡಲಾಗುತ್ತಿದೆ...',
    errorLoading: 'ಆಫರ್‌ಗಳನ್ನು ಲೋಡ್ ಮಾಡುವಲ್ಲಿ ದೋಷ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
    retry: 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ',
    noOffersAvailable: 'ಪ್ರಸ್ತುತ ಆಫರ್‌ಗಳು ಲಭ್ಯವಿಲ್ಲ.',
    validFrom: 'ಇಂದ ಮಾನ್ಯ',
    validUntil: 'ವರೆಗೆ ಮಾನ್ಯ',
    expiresOn: 'ಅವಧಿ ಮುಗಿಯುವ ದಿನಾಂಕ',
    publishAt: 'ಪ್ರಕಟಣೆ ಸಮಯ',
    cancel: 'ರದ್ದುಮಾಡಿ',
    save: 'ಉಳಿಸಿ',
    submit: 'ಸಲ್ಲಿಸಿ',
    close: 'ಮುಚ್ಚಿ',
    back: 'ಹಿಂದೆ',
    next: 'ಮುಂದೆ',
    previous: 'ಹಿಂದಿನ',
    loading: 'ಲೋಡ್ ಆಗುತ್ತಿದೆ...',
    selected: 'ಆಯ್ಕೆಮಾಡಲಾಗಿದೆ',
    selectAll: 'ಎಲ್ಲವನ್ನೂ ಆಯ್ಕೆಮಾಡಿ',
    clearSelection: 'ಆಯ್ಕೆ ತೆರವುಗೊಳಿಸಿ'
  },

  // Malayalam, Marathi, Bengali, Gujarati translations use English as fallback for brevity
  // In production, these would be fully translated
  ml: { ...({} as OffersTranslations) },
  mr: { ...({} as OffersTranslations) },
  bn: { ...({} as OffersTranslations) },
  gu: { ...({} as OffersTranslations) }
}

// Fill in missing translations with English defaults
for (const lang of ['ml', 'mr', 'bn', 'gu'] as SupportedLanguage[]) {
  translations[lang] = { ...translations.en }
}

// Helper hook for using translations
export function useOffersTranslations(language: SupportedLanguage = 'en'): OffersTranslations {
  return translations[language] || translations.en
}

// Get translation by key
export function t(language: SupportedLanguage, key: keyof OffersTranslations): string {
  return translations[language]?.[key] || translations.en[key] || key
}

export default translations
