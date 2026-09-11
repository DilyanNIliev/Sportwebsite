// Игралните повърхности. Съставът знае само схемата си; тук стои как изглежда
// теренът и колко души има на него, за да не е компонентът вързан за футбола.
export const surfaces = {
  pitch: {
    label: 'pitch', aspect: '100 / 150',
    turf: '#17693f', turfDark: '#10432a',
  },
  rugby: {
    label: 'pitch', aspect: '100 / 150',
    turf: '#1d6b3a', turfDark: '#123f26',
  },
  rink: {
    label: 'rink', aspect: '100 / 150',
    turf: '#cfe3f2', turfDark: '#33506b',
    ink: 'rgba(20,50,80,.45)', inkDark: 'rgba(255,255,255,.4)',
    dot: '#1f2937', dotText: '#fff',
  },
  court: {
    label: 'court', aspect: '100 / 150',
    turf: '#b4752f', turfDark: '#5e3c18',
  },
  diamond: {
    label: 'field', aspect: '100 / 110',
    turf: '#2c7a41', turfDark: '#16452a',
  },
  oval: {
    label: 'ground', aspect: '100 / 110',
    turf: '#3f8c46', turfDark: '#1d4a27',
  },
};

export const surfaceFor = (key) => surfaces[key] ?? surfaces.pitch;
