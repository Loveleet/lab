import type { FC } from 'react';
import { useMemo, useState } from 'react';
import type { Holiday } from '../../content/holidays';
import { holidays } from '../../content/holidays';

type ContinentFilter =
  | 'All'
  | 'North America'
  | 'South America'
  | 'Europe'
  | 'Asia'
  | 'Africa'
  | 'Oceania'
  | 'Middle East';

interface HolidayListProps {
  /** Optional: allow passing a custom list (defaults to all holidays from data file). */
  items?: Holiday[];
}

export const HolidayList: FC<HolidayListProps> = ({ items }) => {
  const [continent, setContinent] = useState<ContinentFilter>('All');
  const [countryCode, setCountryCode] = useState<string>('All');
  const [search, setSearch] = useState<string>('');

  const data = items ?? holidays;

  const countries = useMemo(() => {
    const map = new Map<string, string>();
    data.forEach((h: Holiday) => {
      if (!map.has(h.countryCode)) {
        map.set(h.countryCode, h.country);
      }
    });
    return Array.from(map.entries())
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  const filtered = useMemo(() => {
    return data.filter((h: Holiday) => {
      if (continent !== 'All' && h.continent !== continent) return false;
      if (countryCode !== 'All' && h.countryCode !== countryCode) return false;

      if (search.trim()) {
        const s = search.toLowerCase();
        const hay = [
          h.country,
          h.countryCode,
          h.continent,
          h.date,
          ...h.names,
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(s)) return false;
      }

      return true;
    });
  }, [continent, countryCode, search, data]);

  const continentOptions: ContinentFilter[] = [
    'All',
    'Africa',
    'Asia',
    'Europe',
    'North America',
    'South America',
    'Oceania',
    'Middle East',
  ];

  return (
    <div style={{ padding: '1rem', width: '100%', boxSizing: 'border-box' }}>
      <h1 style={{ marginBottom: '1rem' }}>Global Holidays 2025</h1>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.75rem',
          marginBottom: '1rem',
        }}
      >
        <div style={{ minWidth: 180 }}>
          <label
            style={{
              display: 'block',
              fontSize: '0.85rem',
              marginBottom: '0.25rem',
            }}
          >
            Continent
          </label>
          <select
            value={continent}
            onChange={(e) => setContinent(e.target.value as ContinentFilter)}
            style={{
              width: '100%',
              padding: '0.35rem 0.5rem',
              borderRadius: 4,
              border: '1px solid #ccc',
            }}
          >
            {continentOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div style={{ minWidth: 220 }}>
          <label
            style={{
              display: 'block',
              fontSize: '0.85rem',
              marginBottom: '0.25rem',
            }}
          >
            Country
          </label>
          <select
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value)}
            style={{
              width: '100%',
              padding: '0.35rem 0.5rem',
              borderRadius: 4,
              border: '1px solid #ccc',
            }}
          >
            <option value="All">All countries</option>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
        </div>

        <div style={{ flex: 1, minWidth: 220 }}>
          <label
            style={{
              display: 'block',
              fontSize: '0.85rem',
              marginBottom: '0.25rem',
            }}
          >
            Search
          </label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by country, date or holiday name..."
            style={{
              width: '100%',
              padding: '0.35rem 0.5rem',
              borderRadius: 4,
              border: '1px solid #ccc',
            }}
          />
        </div>
      </div>

      <div
        style={{
          fontSize: '0.85rem',
          color: '#555',
          marginBottom: '0.5rem',
        }}
      >
        Showing {filtered.length.toLocaleString()} holidays
        {countryCode !== 'All' && (
          <>
            {' '}
            for{' '}
            {
              countries.find((c) => c.code === countryCode)?.name ??
              countryCode
            }
          </>
        )}
        {continent !== 'All' && ` in ${continent}`}
      </div>

      <div
        style={{
          maxHeight: '70vh',
          overflow: 'auto',
          border: '1px solid #eee',
          borderRadius: 6,
        }}
      >
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '0.9rem',
          }}
        >
          <thead
            style={{
              position: 'sticky',
              top: 0,
              background: '#fafafa',
              zIndex: 1,
            }}
          >
            <tr>
              <th
                style={{
                  textAlign: 'left',
                  padding: '0.5rem',
                  borderBottom: '1px solid #ddd',
                  minWidth: 80,
                }}
              >
                Country
              </th>
              <th
                style={{
                  textAlign: 'left',
                  padding: '0.5rem',
                  borderBottom: '1px solid #ddd',
                  minWidth: 70,
                }}
              >
                Code
              </th>
              <th
                style={{
                  textAlign: 'left',
                  padding: '0.5rem',
                  borderBottom: '1px solid #ddd',
                  minWidth: 110,
                }}
              >
                Continent
              </th>
              <th
                style={{
                  textAlign: 'left',
                  padding: '0.5rem',
                  borderBottom: '1px solid #ddd',
                  minWidth: 100,
                }}
              >
                Date (2025)
              </th>
              <th
                style={{
                  textAlign: 'left',
                  padding: '0.5rem',
                  borderBottom: '1px solid #ddd',
                  minWidth: 220,
                }}
              >
                Holiday name(s)
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((h: Holiday, idx: number) => (
              <tr
                key={`${h.countryCode}-${h.date}-${idx}`}
                style={{
                  backgroundColor: idx % 2 === 0 ? '#fff' : '#f9f9f9',
                }}
              >
                <td
                  style={{
                    padding: '0.4rem 0.5rem',
                    borderBottom: '1px solid #f0f0f0',
                  }}
                >
                  {h.country}
                </td>
                <td
                  style={{
                    padding: '0.4rem 0.5rem',
                    borderBottom: '1px solid #f0f0f0',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {h.countryCode}
                </td>
                <td
                  style={{
                    padding: '0.4rem 0.5rem',
                    borderBottom: '1px solid #f0f0f0',
                  }}
                >
                  {h.continent}
                </td>
                <td
                  style={{
                    padding: '0.4rem 0.5rem',
                    borderBottom: '1px solid #f0f0f0',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {h.date}
                </td>
                <td
                  style={{
                    padding: '0.4rem 0.5rem',
                    borderBottom: '1px solid #f0f0f0',
                  }}
                >
                  {h.names.join(', ')}
                </td>
              </tr>
            ))}

            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  style={{
                    padding: '1rem',
                    textAlign: 'center',
                    color: '#888',
                  }}
                >
                  No holidays match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default HolidayList;
