export function csvJSON(csv: any) {
  const lines = csv.split('\n')
  const result = []
  for (let i = 0; i < lines.length; i++) {
    const currentline = lines[i].split(',').toString().replace(/\W/g, '').replace(/\s/g, '').toLowerCase()
    result.push(currentline)
  }
  return JSON.stringify(result)
}
