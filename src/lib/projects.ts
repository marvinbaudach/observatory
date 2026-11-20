export type ProjectId = 'solari' | 'fluid' | 'observatory';
export type GeometryType = 'torusKnot' | 'icosahedron' | 'octahedron';

export interface Project {
  id: ProjectId;
  title: string;
  description: string;
  tags: string[];
  url: string;
  position: [number, number, number];
  emissiveColor: string;
  accentColor: string;
  geometry: GeometryType;
  floatSpeed: number;
}

export const PROJECTS: Project[] = [
  {
    id: 'solari',
    title: 'Swiss Departure Board',
    description: 'Echtzeit-Abfahrtsboard im Split-Flap-Stil. Stationssuche, Favoriten, Live-Countdown. Alles im Amber-auf-Schwarz-Look klassischer Bahnhofstafeln.',
    tags: ['Next.js', 'TypeScript', 'CSS Animations'],
    url: 'https://marvinbaudach.github.io/solari-board/',
    position: [-4, 0.5, 0],
    emissiveColor: '#c87800',
    accentColor: '#f5a300',
    geometry: 'torusKnot',
    floatSpeed: 1.2,
  },
  {
    id: 'fluid',
    title: 'Domain Warp',
    description: 'Interaktiver WebGL2-Shader mit dreifach verschachteltem FBM-Rauschen und 4-Pass-Bloom-Pipeline. Klicken erzeugt Schockwellen in der Flüssigkeit.',
    tags: ['WebGL2', 'GLSL', 'React'],
    url: 'https://marvinbaudach.github.io/fluid/',
    position: [4, -0.5, 0],
    emissiveColor: '#c03000',
    accentColor: '#ff5020',
    geometry: 'icosahedron',
    floatSpeed: 1.6,
  },
  {
    id: 'observatory',
    title: 'Observatory',
    description: 'Dieses Projekt. Interaktive 3D-Szene mit React Three Fiber: Nebel aus domain-warped FBM-Rauschen, Bloom-Postprocessing und Kameraflüge zu den Projekten.',
    tags: ['React Three Fiber', 'Three.js', 'GLSL'],
    url: 'https://marvinbaudach.github.io/observatory/',
    position: [0, 2.5, -2],
    emissiveColor: '#2040e0',
    accentColor: '#4488ff',
    geometry: 'octahedron',
    floatSpeed: 1.9,
  },
];
