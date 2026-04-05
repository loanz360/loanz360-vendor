-- ULAP Seed Data
-- Run this after ulap-tables.sql to populate initial data

-- =====================================================
-- Insert Banks and NBFCs
-- =====================================================
INSERT INTO ulap_banks (name, short_code, logo_url, type, website_url, display_order) VALUES
('HDFC Bank', 'HDFC', 'https://logo.clearbit.com/hdfcbank.com', 'BANK', 'https://www.hdfcbank.com', 1),
('ICICI Bank', 'ICICI', 'https://logo.clearbit.com/icicibank.com', 'BANK', 'https://www.icicibank.com', 2),
('State Bank of India', 'SBI', 'https://logo.clearbit.com/sbi.co.in', 'BANK', 'https://www.sbi.co.in', 3),
('Axis Bank', 'AXIS', 'https://logo.clearbit.com/axisbank.com', 'BANK', 'https://www.axisbank.com', 4),
('Kotak Mahindra Bank', 'KOTAK', 'https://logo.clearbit.com/kotak.com', 'BANK', 'https://www.kotak.com', 5),
('Bajaj Finserv', 'BAJAJ', 'https://logo.clearbit.com/bajajfinserv.in', 'NBFC', 'https://www.bajajfinserv.in', 6),
('Tata Capital', 'TATA', 'https://logo.clearbit.com/tatacapital.com', 'NBFC', 'https://www.tatacapital.com', 7),
('IDFC First Bank', 'IDFC', 'https://logo.clearbit.com/idfcfirstbank.com', 'BANK', 'https://www.idfcfirstbank.com', 8),
('IndusInd Bank', 'INDUSIND', 'https://logo.clearbit.com/indusind.com', 'BANK', 'https://www.indusind.com', 9),
('Yes Bank', 'YES', 'https://logo.clearbit.com/yesbank.in', 'BANK', 'https://www.yesbank.in', 10),
('Punjab National Bank', 'PNB', 'https://logo.clearbit.com/pnbindia.in', 'BANK', 'https://www.pnbindia.in', 11),
('Bank of Baroda', 'BOB', 'https://logo.clearbit.com/bankofbaroda.in', 'BANK', 'https://www.bankofbaroda.in', 12),
('Canara Bank', 'CANARA', 'https://logo.clearbit.com/canarabank.com', 'BANK', 'https://canarabank.com', 13),
('Union Bank of India', 'UNION', 'https://logo.clearbit.com/unionbankofindia.co.in', 'BANK', 'https://www.unionbankofindia.co.in', 14),
('HDFC Ltd', 'HDFCLTD', 'https://logo.clearbit.com/hdfc.com', 'HFC', 'https://www.hdfc.com', 15),
('LIC Housing Finance', 'LICHFL', 'https://logo.clearbit.com/lichousing.com', 'HFC', 'https://www.lichousing.com', 16),
('Fullerton India', 'FULLERTON', 'https://logo.clearbit.com/fullertonindia.com', 'NBFC', 'https://www.fullertonindia.com', 17),
('L&T Finance', 'LNT', 'https://logo.clearbit.com/ltfs.com', 'NBFC', 'https://www.ltfs.com', 18),
('Piramal Finance', 'PIRAMAL', 'https://logo.clearbit.com/piramalfinance.com', 'NBFC', 'https://www.piramalfinance.com', 19),
('Cholamandalam Finance', 'CHOLA', 'https://logo.clearbit.com/cholamandalam.com', 'NBFC', 'https://www.cholamandalam.com', 20)
ON CONFLICT (short_code) DO NOTHING;

-- =====================================================
-- Insert Loan Categories
-- =====================================================
INSERT INTO ulap_loan_categories (name, slug, description, image_url, display_order) VALUES
('Personal Loans', 'personal_loans', 'Unsecured loans for personal needs including new loans, top-up, balance transfer, and debt consolidation.', 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&h=300&fit=crop', 1),
('Business Loans', 'business_loans', 'Funding solutions for businesses including working capital, MSME loans, and startup financing.', 'https://images.unsplash.com/photo-1664575602554-2087b04935a5?w=400&h=300&fit=crop', 2),
('Home Loans', 'home_loans', 'Finance your dream home with competitive rates for purchase, construction, and renovation.', 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=400&h=300&fit=crop', 3),
('Mortgage/LAP', 'mortgage_lap', 'Loan against property for residential, commercial, and industrial properties.', 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400&h=300&fit=crop', 4),
('Vehicle Loans', 'vehicle_loans', 'New and used vehicle financing for cars, two-wheelers, and commercial vehicles.', 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=400&h=300&fit=crop', 5),
('Loan to Professionals', 'loan_to_professionals', 'Tailored loans for doctors, CAs, lawyers, architects and other professionals.', 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=400&h=300&fit=crop', 6),
('Loan Against Securities', 'loan_against_securities', 'Leverage your investments - shares, mutual funds, and insurance policies.', 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&h=300&fit=crop', 7),
('Education Loans', 'education_loans', 'Fund your education in India or abroad with flexible repayment options.', 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=400&h=300&fit=crop', 8),
('Gold Loans', 'gold_loans', 'Quick loans against your gold jewelry with minimal documentation.', 'https://images.unsplash.com/photo-1610375461246-83df859d849d?w=400&h=300&fit=crop', 9),
('Government Schemes', 'government_schemes', 'Access subsidized loans under PM schemes like Mudra and Stand-Up India.', 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=400&h=300&fit=crop', 10),
('Rural & Agri Loans', 'rural_agri_loans', 'Agricultural and rural development financing including KCC and tractor loans.', 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=400&h=300&fit=crop', 11),
('NRI Loans', 'nri_loans', 'Specialized loans for Non-Resident Indians for home purchase and investment.', 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=400&h=300&fit=crop', 12),
('Overdraft Facility', 'overdraft_facility', 'Flexible credit line against salary, property, or fixed deposits.', 'https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=400&h=300&fit=crop', 13),
('Senior Citizen Loans', 'senior_citizen_loans', 'Special loan products designed for senior citizens with relaxed criteria.', 'https://images.unsplash.com/photo-1447069387593-a5de0862481e?w=400&h=300&fit=crop', 14)
ON CONFLICT (slug) DO NOTHING;

-- =====================================================
-- Insert Loan Subcategories
-- =====================================================

-- Personal Loans subcategories
INSERT INTO ulap_loan_subcategories (category_id, name, slug, description, image_url, display_order)
SELECT id, 'New Personal Loan', 'new_personal_loan', 'Fresh personal loan for any purpose', 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&h=300&fit=crop', 1
FROM ulap_loan_categories WHERE slug = 'personal_loans'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO ulap_loan_subcategories (category_id, name, slug, description, image_url, display_order)
SELECT id, 'Top-up Loan', 'topup_loan', 'Additional loan on existing personal loan', 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=400&h=300&fit=crop', 2
FROM ulap_loan_categories WHERE slug = 'personal_loans'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO ulap_loan_subcategories (category_id, name, slug, description, image_url, display_order)
SELECT id, 'Balance Transfer', 'balance_transfer', 'Transfer existing loan at lower rates', 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=400&h=300&fit=crop', 3
FROM ulap_loan_categories WHERE slug = 'personal_loans'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO ulap_loan_subcategories (category_id, name, slug, description, image_url, display_order)
SELECT id, 'Debt Consolidation', 'debt_consolidation', 'Consolidate multiple loans into one', 'https://images.unsplash.com/photo-1554224154-22dec7ec8818?w=400&h=300&fit=crop', 4
FROM ulap_loan_categories WHERE slug = 'personal_loans'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO ulap_loan_subcategories (category_id, name, slug, description, image_url, display_order)
SELECT id, 'Overdraft/Flexi Loan', 'overdraft_flexi', 'Flexible credit line, pay interest on usage', 'https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=400&h=300&fit=crop', 5
FROM ulap_loan_categories WHERE slug = 'personal_loans'
ON CONFLICT (slug) DO NOTHING;

-- Business Loans subcategories
INSERT INTO ulap_loan_subcategories (category_id, name, slug, description, image_url, display_order)
SELECT id, 'New Business Loan', 'new_business_loan', 'Fresh business loan for expansion', 'https://images.unsplash.com/photo-1664575602554-2087b04935a5?w=400&h=300&fit=crop', 1
FROM ulap_loan_categories WHERE slug = 'business_loans'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO ulap_loan_subcategories (category_id, name, slug, description, image_url, display_order)
SELECT id, 'MSME Loan', 'msme_loan', 'Loans for micro, small and medium enterprises', 'https://images.unsplash.com/photo-1556761175-b413da4baf72?w=400&h=300&fit=crop', 2
FROM ulap_loan_categories WHERE slug = 'business_loans'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO ulap_loan_subcategories (category_id, name, slug, description, image_url, display_order)
SELECT id, 'Startup Loan', 'startup_loan', 'Funding for new business ventures', 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=400&h=300&fit=crop', 3
FROM ulap_loan_categories WHERE slug = 'business_loans'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO ulap_loan_subcategories (category_id, name, slug, description, image_url, display_order)
SELECT id, 'Business Balance Transfer', 'business_bt', 'Transfer business loan at lower rates', 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=400&h=300&fit=crop', 4
FROM ulap_loan_categories WHERE slug = 'business_loans'
ON CONFLICT (slug) DO NOTHING;

-- Home Loans subcategories
INSERT INTO ulap_loan_subcategories (category_id, name, slug, description, image_url, display_order)
SELECT id, 'New Home Loan', 'new_home_loan', 'Finance for home purchase', 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=400&h=300&fit=crop', 1
FROM ulap_loan_categories WHERE slug = 'home_loans'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO ulap_loan_subcategories (category_id, name, slug, description, image_url, display_order)
SELECT id, 'Home Construction Loan', 'home_construction', 'Finance for building your home', 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&h=300&fit=crop', 2
FROM ulap_loan_categories WHERE slug = 'home_loans'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO ulap_loan_subcategories (category_id, name, slug, description, image_url, display_order)
SELECT id, 'Home Improvement Loan', 'home_improvement', 'Finance for renovation and repair', 'https://images.unsplash.com/photo-1581858726788-75bc0f6a952d?w=400&h=300&fit=crop', 3
FROM ulap_loan_categories WHERE slug = 'home_loans'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO ulap_loan_subcategories (category_id, name, slug, description, image_url, display_order)
SELECT id, 'Plot Purchase Loan', 'plot_purchase', 'Finance for buying land', 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=400&h=300&fit=crop', 4
FROM ulap_loan_categories WHERE slug = 'home_loans'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO ulap_loan_subcategories (category_id, name, slug, description, image_url, display_order)
SELECT id, 'Home Loan Balance Transfer', 'home_bt', 'Transfer home loan at lower rates', 'https://images.unsplash.com/photo-1560520031-3a4dc4e9de0c?w=400&h=300&fit=crop', 5
FROM ulap_loan_categories WHERE slug = 'home_loans'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO ulap_loan_subcategories (category_id, name, slug, description, image_url, display_order)
SELECT id, 'Home Loan Top-up', 'home_topup', 'Additional loan on existing home loan', 'https://images.unsplash.com/photo-1560520653-9e0e4c89eb11?w=400&h=300&fit=crop', 6
FROM ulap_loan_categories WHERE slug = 'home_loans'
ON CONFLICT (slug) DO NOTHING;

-- Vehicle Loans subcategories
INSERT INTO ulap_loan_subcategories (category_id, name, slug, description, image_url, display_order)
SELECT id, 'New Car Loan', 'new_car_loan', 'Finance for new car purchase', 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=400&h=300&fit=crop', 1
FROM ulap_loan_categories WHERE slug = 'vehicle_loans'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO ulap_loan_subcategories (category_id, name, slug, description, image_url, display_order)
SELECT id, 'Used Car Loan', 'used_car_loan', 'Finance for pre-owned cars', 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=400&h=300&fit=crop', 2
FROM ulap_loan_categories WHERE slug = 'vehicle_loans'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO ulap_loan_subcategories (category_id, name, slug, description, image_url, display_order)
SELECT id, 'Two-Wheeler Loan', 'two_wheeler_loan', 'Finance for bikes and scooters', 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=400&h=300&fit=crop', 3
FROM ulap_loan_categories WHERE slug = 'vehicle_loans'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO ulap_loan_subcategories (category_id, name, slug, description, image_url, display_order)
SELECT id, 'Commercial Vehicle Loan', 'commercial_vehicle_loan', 'Finance for trucks, buses, and commercial vehicles', 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=400&h=300&fit=crop', 4
FROM ulap_loan_categories WHERE slug = 'vehicle_loans'
ON CONFLICT (slug) DO NOTHING;

-- Loan to Professionals subcategories
INSERT INTO ulap_loan_subcategories (category_id, name, slug, description, image_url, display_order)
SELECT id, 'Doctor Loan', 'doctor_loan', 'Loans for medical practitioners', 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=400&h=300&fit=crop', 1
FROM ulap_loan_categories WHERE slug = 'loan_to_professionals'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO ulap_loan_subcategories (category_id, name, slug, description, image_url, display_order)
SELECT id, 'CA Loan', 'ca_loan', 'Loans for Chartered Accountants', 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=400&h=300&fit=crop', 2
FROM ulap_loan_categories WHERE slug = 'loan_to_professionals'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO ulap_loan_subcategories (category_id, name, slug, description, image_url, display_order)
SELECT id, 'Lawyer Loan', 'lawyer_loan', 'Loans for advocates and lawyers', 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=400&h=300&fit=crop', 3
FROM ulap_loan_categories WHERE slug = 'loan_to_professionals'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO ulap_loan_subcategories (category_id, name, slug, description, image_url, display_order)
SELECT id, 'Architect Loan', 'architect_loan', 'Loans for architects', 'https://images.unsplash.com/photo-1487958449943-2429e8be8625?w=400&h=300&fit=crop', 4
FROM ulap_loan_categories WHERE slug = 'loan_to_professionals'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO ulap_loan_subcategories (category_id, name, slug, description, image_url, display_order)
SELECT id, 'Practice Setup Loan', 'practice_setup', 'Setup clinic, office, or studio', 'https://images.unsplash.com/photo-1497215842964-222b430dc094?w=400&h=300&fit=crop', 5
FROM ulap_loan_categories WHERE slug = 'loan_to_professionals'
ON CONFLICT (slug) DO NOTHING;

-- Education Loans subcategories
INSERT INTO ulap_loan_subcategories (category_id, name, slug, description, image_url, display_order)
SELECT id, 'Education Loan - India', 'education_india', 'Fund higher education in India', 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=400&h=300&fit=crop', 1
FROM ulap_loan_categories WHERE slug = 'education_loans'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO ulap_loan_subcategories (category_id, name, slug, description, image_url, display_order)
SELECT id, 'Education Loan - Abroad', 'education_abroad', 'Study abroad financing', 'https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?w=400&h=300&fit=crop', 2
FROM ulap_loan_categories WHERE slug = 'education_loans'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO ulap_loan_subcategories (category_id, name, slug, description, image_url, display_order)
SELECT id, 'Skill Development Loan', 'skill_development', 'Short-term courses and certifications', 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=400&h=300&fit=crop', 3
FROM ulap_loan_categories WHERE slug = 'education_loans'
ON CONFLICT (slug) DO NOTHING;

-- Gold Loans subcategories
INSERT INTO ulap_loan_subcategories (category_id, name, slug, description, image_url, display_order)
SELECT id, 'Gold Loan', 'gold_loan', 'Loan against gold jewelry', 'https://images.unsplash.com/photo-1610375461246-83df859d849d?w=400&h=300&fit=crop', 1
FROM ulap_loan_categories WHERE slug = 'gold_loans'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO ulap_loan_subcategories (category_id, name, slug, description, image_url, display_order)
SELECT id, 'Gold Loan Overdraft', 'gold_loan_od', 'Overdraft facility against gold', 'https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=400&h=300&fit=crop', 2
FROM ulap_loan_categories WHERE slug = 'gold_loans'
ON CONFLICT (slug) DO NOTHING;

-- Mortgage/LAP subcategories
INSERT INTO ulap_loan_subcategories (category_id, name, slug, description, image_url, display_order)
SELECT id, 'LAP - Residential', 'lap_residential', 'Loan against residential property', 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=400&h=300&fit=crop', 1
FROM ulap_loan_categories WHERE slug = 'mortgage_lap'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO ulap_loan_subcategories (category_id, name, slug, description, image_url, display_order)
SELECT id, 'LAP - Commercial', 'lap_commercial', 'Loan against commercial property', 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400&h=300&fit=crop', 2
FROM ulap_loan_categories WHERE slug = 'mortgage_lap'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO ulap_loan_subcategories (category_id, name, slug, description, image_url, display_order)
SELECT id, 'LAP - Industrial', 'lap_industrial', 'Loan against industrial property', 'https://images.unsplash.com/photo-1565636291267-c7e9e0da56c7?w=400&h=300&fit=crop', 3
FROM ulap_loan_categories WHERE slug = 'mortgage_lap'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO ulap_loan_subcategories (category_id, name, slug, description, image_url, display_order)
SELECT id, 'LAP Balance Transfer', 'lap_bt', 'Transfer LAP at lower rates', 'https://images.unsplash.com/photo-1560520031-3a4dc4e9de0c?w=400&h=300&fit=crop', 4
FROM ulap_loan_categories WHERE slug = 'mortgage_lap'
ON CONFLICT (slug) DO NOTHING;

-- Loan Against Securities subcategories
INSERT INTO ulap_loan_subcategories (category_id, name, slug, description, image_url, display_order)
SELECT id, 'Loan Against Shares', 'loan_against_shares', 'Loan against listed shares', 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&h=300&fit=crop', 1
FROM ulap_loan_categories WHERE slug = 'loan_against_securities'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO ulap_loan_subcategories (category_id, name, slug, description, image_url, display_order)
SELECT id, 'Loan Against Mutual Funds', 'loan_against_mf', 'Loan against mutual fund units', 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400&h=300&fit=crop', 2
FROM ulap_loan_categories WHERE slug = 'loan_against_securities'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO ulap_loan_subcategories (category_id, name, slug, description, image_url, display_order)
SELECT id, 'Loan Against Insurance', 'loan_against_insurance', 'Loan against insurance policies', 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=400&h=300&fit=crop', 3
FROM ulap_loan_categories WHERE slug = 'loan_against_securities'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO ulap_loan_subcategories (category_id, name, slug, description, image_url, display_order)
SELECT id, 'Loan Against FD', 'loan_against_fd', 'Loan against fixed deposits', 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=400&h=300&fit=crop', 4
FROM ulap_loan_categories WHERE slug = 'loan_against_securities'
ON CONFLICT (slug) DO NOTHING;

-- Government Schemes subcategories
INSERT INTO ulap_loan_subcategories (category_id, name, slug, description, image_url, display_order)
SELECT id, 'PM Mudra Loan', 'pm_mudra', 'Pradhan Mantri Mudra Yojana', 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=400&h=300&fit=crop', 1
FROM ulap_loan_categories WHERE slug = 'government_schemes'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO ulap_loan_subcategories (category_id, name, slug, description, image_url, display_order)
SELECT id, 'Stand-Up India', 'standup_india', 'For SC/ST and women entrepreneurs', 'https://images.unsplash.com/photo-1573164713714-d95e436ab8d6?w=400&h=300&fit=crop', 2
FROM ulap_loan_categories WHERE slug = 'government_schemes'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO ulap_loan_subcategories (category_id, name, slug, description, image_url, display_order)
SELECT id, 'PMEGP Loan', 'pmegp', 'PM Employment Generation Programme', 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=400&h=300&fit=crop', 3
FROM ulap_loan_categories WHERE slug = 'government_schemes'
ON CONFLICT (slug) DO NOTHING;
