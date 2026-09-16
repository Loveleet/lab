export type Holiday = {
  countryCode: string; // ISO 3166-1 alpha-2
  country: string;
  continent:
    | 'North America'
    | 'South America'
    | 'Europe'
    | 'Asia'
    | 'Africa'
    | 'Oceania'
    | 'Middle East';
  date: string; // YYYY-MM-DD
  names: string[];
};

export const holidays: Holiday[] = [
  // --- Australia (AU) ----------------------------------------------------
  {
    countryCode: 'AU',
    country: 'Australia',
    continent: 'Oceania',
    date: '2025-01-01',
    names: ["New Year's Day"]
  },
  {
    countryCode: 'AU',
    country: 'Australia',
    continent: 'Oceania',
    date: '2025-01-26',
    names: ['Australia Day']
  },
  {
    countryCode: 'AU',
    country: 'Australia',
    continent: 'Oceania',
    date: '2025-01-27',
    names: ['Australia Day (Observed)']
  },
  {
    countryCode: 'AU',
    country: 'Australia',
    continent: 'Oceania',
    date: '2025-04-18',
    names: ['Good Friday']
  },
  {
    countryCode: 'AU',
    country: 'Australia',
    continent: 'Oceania',
    date: '2025-04-21',
    names: ['Easter Monday']
  },
  {
    countryCode: 'AU',
    country: 'Australia',
    continent: 'Oceania',
    date: '2025-04-25',
    names: ['ANZAC Day']
  },
  {
    countryCode: 'AU',
    country: 'Australia',
    continent: 'Oceania',
    date: '2025-12-25',
    names: ['Christmas Day']
  },
  {
    countryCode: 'AU',
    country: 'Australia',
    continent: 'Oceania',
    date: '2025-12-26',
    names: ['Boxing Day']
  },

  // --- Canada (CA) -------------------------------------------------------
  {
    countryCode: 'CA',
    country: 'Canada',
    continent: 'North America',
    date: '2025-01-01',
    names: ["New Year's Day"]
  },
  {
    countryCode: 'CA',
    country: 'Canada',
    continent: 'North America',
    date: '2025-04-18',
    names: ['Good Friday']
  },
  {
    countryCode: 'CA',
    country: 'Canada',
    continent: 'North America',
    date: '2025-05-19',
    names: ['Victoria Day']
  },
  {
    countryCode: 'CA',
    country: 'Canada',
    continent: 'North America',
    date: '2025-07-01',
    names: ['Canada Day']
  },
  {
    countryCode: 'CA',
    country: 'Canada',
    continent: 'North America',
    date: '2025-09-01',
    names: ['Labour Day']
  },
  {
    countryCode: 'CA',
    country: 'Canada',
    continent: 'North America',
    date: '2025-09-30',
    names: ['National Day for Truth and Reconciliation']
  },
  {
    countryCode: 'CA',
    country: 'Canada',
    continent: 'North America',
    date: '2025-10-13',
    names: ['Thanksgiving Day']
  },
  {
    countryCode: 'CA',
    country: 'Canada',
    continent: 'North America',
    date: '2025-11-11',
    names: ['Remembrance Day']
  },
  {
    countryCode: 'CA',
    country: 'Canada',
    continent: 'North America',
    date: '2025-12-25',
    names: ['Christmas Day']
  },
  {
    countryCode: 'CA',
    country: 'Canada',
    continent: 'North America',
    date: '2025-12-26',
    names: ['Boxing Day']
  },

  // --- China (CN) --------------------------------------------------------
  {
    countryCode: 'CN',
    country: 'China',
    continent: 'Asia',
    date: '2025-01-01',
    names: ["New Year's Day"]
  },
  { countryCode: 'CN', country: 'China', continent: 'Asia', date: '2025-01-28', names: ['Spring Festival / Chinese New Year Holiday'] },
  { countryCode: 'CN', country: 'China', continent: 'Asia', date: '2025-01-29', names: ['Spring Festival / Chinese New Year Holiday'] },
  { countryCode: 'CN', country: 'China', continent: 'Asia', date: '2025-01-30', names: ['Spring Festival / Chinese New Year Holiday'] },
  { countryCode: 'CN', country: 'China', continent: 'Asia', date: '2025-01-31', names: ['Spring Festival / Chinese New Year Holiday'] },
  { countryCode: 'CN', country: 'China', continent: 'Asia', date: '2025-02-01', names: ['Spring Festival / Chinese New Year Holiday'] },
  { countryCode: 'CN', country: 'China', continent: 'Asia', date: '2025-02-02', names: ['Spring Festival / Chinese New Year Holiday'] },
  { countryCode: 'CN', country: 'China', continent: 'Asia', date: '2025-02-03', names: ['Spring Festival / Chinese New Year Holiday'] },
  { countryCode: 'CN', country: 'China', continent: 'Asia', date: '2025-02-04', names: ['Spring Festival / Chinese New Year Holiday'] },
  { countryCode: 'CN', country: 'China', continent: 'Asia', date: '2025-04-04', names: ['Qingming (Tomb-Sweeping) Festival'] },
  { countryCode: 'CN', country: 'China', continent: 'Asia', date: '2025-04-05', names: ['Qingming (Tomb-Sweeping) Festival'] },
  { countryCode: 'CN', country: 'China', continent: 'Asia', date: '2025-04-06', names: ['Qingming (Tomb-Sweeping) Festival'] },
  { countryCode: 'CN', country: 'China', continent: 'Asia', date: '2025-05-01', names: ['Labour Day Holiday'] },
  { countryCode: 'CN', country: 'China', continent: 'Asia', date: '2025-05-02', names: ['Labour Day Holiday'] },
  { countryCode: 'CN', country: 'China', continent: 'Asia', date: '2025-05-03', names: ['Labour Day Holiday'] },
  { countryCode: 'CN', country: 'China', continent: 'Asia', date: '2025-05-04', names: ['Labour Day Holiday'] },
  { countryCode: 'CN', country: 'China', continent: 'Asia', date: '2025-05-05', names: ['Labour Day Holiday'] },
  { countryCode: 'CN', country: 'China', continent: 'Asia', date: '2025-05-31', names: ['Dragon Boat Festival Holiday'] },
  { countryCode: 'CN', country: 'China', continent: 'Asia', date: '2025-06-01', names: ['Dragon Boat Festival Holiday'] },
  { countryCode: 'CN', country: 'China', continent: 'Asia', date: '2025-06-02', names: ['Dragon Boat Festival Holiday'] },
  { countryCode: 'CN', country: 'China', continent: 'Asia', date: '2025-10-01', names: ['National Day Holiday'] },
  { countryCode: 'CN', country: 'China', continent: 'Asia', date: '2025-10-02', names: ['National Day Holiday'] },
  { countryCode: 'CN', country: 'China', continent: 'Asia', date: '2025-10-03', names: ['National Day Holiday'] },
  { countryCode: 'CN', country: 'China', continent: 'Asia', date: '2025-10-04', names: ['National Day Holiday'] },
  { countryCode: 'CN', country: 'China', continent: 'Asia', date: '2025-10-05', names: ['National Day Holiday'] },
  { countryCode: 'CN', country: 'China', continent: 'Asia', date: '2025-10-06', names: ['National Day Holiday', 'Mid-Autumn Festival'] },
  { countryCode: 'CN', country: 'China', continent: 'Asia', date: '2025-10-07', names: ['National Day Holiday'] },
  { countryCode: 'CN', country: 'China', continent: 'Asia', date: '2025-10-08', names: ['National Day Holiday'] },

  // --- European Union Institutions (EU) ----------------------------------
  { countryCode: 'EU', country: 'European Union', continent: 'Europe', date: '2025-01-01', names: ["New Year's Day"] },
  { countryCode: 'EU', country: 'European Union', continent: 'Europe', date: '2025-01-02', names: ['Day after New Year’s Day'] },
  { countryCode: 'EU', country: 'European Union', continent: 'Europe', date: '2025-04-17', names: ['Maundy Thursday'] },
  { countryCode: 'EU', country: 'European Union', continent: 'Europe', date: '2025-04-18', names: ['Good Friday'] },
  { countryCode: 'EU', country: 'European Union', continent: 'Europe', date: '2025-04-21', names: ['Easter Monday'] },
  { countryCode: 'EU', country: 'European Union', continent: 'Europe', date: '2025-05-01', names: ['Labour Day'] },
  { countryCode: 'EU', country: 'European Union', continent: 'Europe', date: '2025-05-09', names: ['Anniversary of the Schuman Declaration (Europe Day)'] },
  { countryCode: 'EU', country: 'European Union', continent: 'Europe', date: '2025-05-29', names: ['Ascension Day'] },
  { countryCode: 'EU', country: 'European Union', continent: 'Europe', date: '2025-05-30', names: ['Day after Ascension Day'] },
  { countryCode: 'EU', country: 'European Union', continent: 'Europe', date: '2025-06-09', names: ['Whit Monday'] },
  { countryCode: 'EU', country: 'European Union', continent: 'Europe', date: '2025-08-15', names: ['Assumption'] },
  { countryCode: 'EU', country: 'European Union', continent: 'Europe', date: '2025-12-24', names: ['End-of-year Holiday'] },
  { countryCode: 'EU', country: 'European Union', continent: 'Europe', date: '2025-12-25', names: ['Christmas Day'] },
  { countryCode: 'EU', country: 'European Union', continent: 'Europe', date: '2025-12-26', names: ['St. Stephen’s Day / Boxing Day'] },
  { countryCode: 'EU', country: 'European Union', continent: 'Europe', date: '2025-12-29', names: ['End-of-year Holiday'] },
  { countryCode: 'EU', country: 'European Union', continent: 'Europe', date: '2025-12-30', names: ['End-of-year Holiday'] },
  { countryCode: 'EU', country: 'European Union', continent: 'Europe', date: '2025-12-31', names: ['End-of-year Holiday'] },

  // --- India (IN) --------------------------------------------------------
  { countryCode: 'IN', country: 'India', continent: 'Asia', date: '2025-01-26', names: ['Republic Day'] },
  { countryCode: 'IN', country: 'India', continent: 'Asia', date: '2025-02-26', names: ['Maha Shivratri'] },
  { countryCode: 'IN', country: 'India', continent: 'Asia', date: '2025-03-14', names: ['Holi'] },
  { countryCode: 'IN', country: 'India', continent: 'Asia', date: '2025-03-31', names: ['Id-ul-Fitr (Ramzan Eid)'] },
  { countryCode: 'IN', country: 'India', continent: 'Asia', date: '2025-04-10', names: ['Mahavir Jayanti'] },
  { countryCode: 'IN', country: 'India', continent: 'Asia', date: '2025-04-18', names: ['Good Friday'] },
  { countryCode: 'IN', country: 'India', continent: 'Asia', date: '2025-05-12', names: ['Buddha Purnima'] },
  { countryCode: 'IN', country: 'India', continent: 'Asia', date: '2025-06-07', names: ['Id-ul-Zuha (Bakrid)'] },
  { countryCode: 'IN', country: 'India', continent: 'Asia', date: '2025-07-06', names: ['Muharram'] },
  { countryCode: 'IN', country: 'India', continent: 'Asia', date: '2025-08-15', names: ['Independence Day'] },
  { countryCode: 'IN', country: 'India', continent: 'Asia', date: '2025-08-16', names: ['Janmashtami (Krishna Jayanti)'] },
  { countryCode: 'IN', country: 'India', continent: 'Asia', date: '2025-09-05', names: ['Id-e-Milad (Birthday of Prophet Muhammad)'] },
  { countryCode: 'IN', country: 'India', continent: 'Asia', date: '2025-10-02', names: ['Mahatma Gandhi Jayanti', 'Dussehra / Vijaya Dashami'] },
  { countryCode: 'IN', country: 'India', continent: 'Asia', date: '2025-10-20', names: ['Diwali / Deepawali'] },
  { countryCode: 'IN', country: 'India', continent: 'Asia', date: '2025-11-05', names: ['Guru Nanak Jayanti'] },
  { countryCode: 'IN', country: 'India', continent: 'Asia', date: '2025-12-25', names: ['Christmas Day'] },

  // --- Japan (JP) --------------------------------------------------------
  { countryCode: 'JP', country: 'Japan', continent: 'Asia', date: '2025-01-01', names: ["New Year's Day"] },
  { countryCode: 'JP', country: 'Japan', continent: 'Asia', date: '2025-01-13', names: ['Coming-of-Age Day'] },
  { countryCode: 'JP', country: 'Japan', continent: 'Asia', date: '2025-02-11', names: ['National Foundation Day'] },
  { countryCode: 'JP', country: 'Japan', continent: 'Asia', date: '2025-02-24', names: ["Emperor's Birthday (Observed)"] },
  { countryCode: 'JP', country: 'Japan', continent: 'Asia', date: '2025-03-20', names: ['Vernal Equinox Day'] },
  { countryCode: 'JP', country: 'Japan', continent: 'Asia', date: '2025-04-29', names: ['Showa Day'] },
  { countryCode: 'JP', country: 'Japan', continent: 'Asia', date: '2025-05-03', names: ['Constitution Memorial Day'] },
  { countryCode: 'JP', country: 'Japan', continent: 'Asia', date: '2025-05-04', names: ['Greenery Day'] },
  { countryCode: 'JP', country: 'Japan', continent: 'Asia', date: '2025-05-05', names: ["Children's Day"] },
  { countryCode: 'JP', country: 'Japan', continent: 'Asia', date: '2025-05-06', names: ['Greenery Day (in lieu)'] },
  { countryCode: 'JP', country: 'Japan', continent: 'Asia', date: '2025-07-21', names: ['Marine Day'] },
  { countryCode: 'JP', country: 'Japan', continent: 'Asia', date: '2025-08-11', names: ['Mountain Day'] },
  { countryCode: 'JP', country: 'Japan', continent: 'Asia', date: '2025-09-15', names: ['Respect for the Aged Day'] },
  { countryCode: 'JP', country: 'Japan', continent: 'Asia', date: '2025-09-23', names: ['Autumnal Equinox Day'] },
  { countryCode: 'JP', country: 'Japan', continent: 'Asia', date: '2025-10-13', names: ['Health and Sports Day'] },
  { countryCode: 'JP', country: 'Japan', continent: 'Asia', date: '2025-11-03', names: ['Culture Day'] },
  { countryCode: 'JP', country: 'Japan', continent: 'Asia', date: '2025-11-23', names: ['Labour Thanksgiving Day'] },
  { countryCode: 'JP', country: 'Japan', continent: 'Asia', date: '2025-11-24', names: ['Labour Thanksgiving Day (in lieu)'] },

  // --- United States (US) -----------------------------------------------
  { countryCode: 'US', country: 'United States', continent: 'North America', date: '2025-01-01', names: ["New Year's Day"] },
  { countryCode: 'US', country: 'United States', continent: 'North America', date: '2025-01-20', names: ['Martin Luther King Jr. Day', 'Inauguration Day'] },
  { countryCode: 'US', country: 'United States', continent: 'North America', date: '2025-02-17', names: ["Washington's Birthday / Presidents Day"] },
  { countryCode: 'US', country: 'United States', continent: 'North America', date: '2025-05-26', names: ['Memorial Day'] },
  { countryCode: 'US', country: 'United States', continent: 'North America', date: '2025-06-19', names: ['Juneteenth National Independence Day'] },
  { countryCode: 'US', country: 'United States', continent: 'North America', date: '2025-07-04', names: ['Independence Day'] },
  { countryCode: 'US', country: 'United States', continent: 'North America', date: '2025-09-01', names: ['Labor Day'] },
  { countryCode: 'US', country: 'United States', continent: 'North America', date: '2025-10-13', names: ['Columbus Day'] },
  { countryCode: 'US', country: 'United States', continent: 'North America', date: '2025-11-11', names: ['Veterans Day'] },
  { countryCode: 'US', country: 'United States', continent: 'North America', date: '2025-11-27', names: ['Thanksgiving Day'] },
  { countryCode: 'US', country: 'United States', continent: 'North America', date: '2025-12-25', names: ['Christmas Day'] }
];
