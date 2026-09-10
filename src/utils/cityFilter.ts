/**
 * Filtro PostgREST para las ciudades activas del usuario. Los valores van entre
 * comillas dobles porque hay ciudades con espacios ("Bahía Blanca"), y se
 * incluye `city.is.null` para que los registros sin ciudad cargada no queden
 * invisibles para todos.
 */
export function buildCityOrFilter(cities: string[]) {
  const quotedCities = cities
    .map(city => `"${city.replace(/"/g, '')}"`)
    .join(',');

  return `city.in.(${quotedCities}),city.is.null`;
}
