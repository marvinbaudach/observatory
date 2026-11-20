export type ProjectId = 'worldpulse' | 'aquarium' | 'observatory';
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
    id: 'worldpulse',
    title: 'Worldpulse',
    description: 'Live-data dashboards drawn in Canvas 2D. A searchable card grid with lightbox on desktop, a swipe deck on mobile, in German, English, French and Italian.',
    tags: ['React', 'TypeScript', 'Canvas 2D'],
    url: 'https://marvinbaudach.github.io/worldpulse/',
    position: [-4, 0.5, 0],
    emissiveColor: '#c87800',
    accentColor: '#f5a300',
    geometry: 'torusKnot',
    floatSpeed: 1.2,
  },
  {
    id: 'aquarium',
    title: 'Aquarium',
    description: 'A sea turtle swims in a glass cube among floating spheres. Sliders for turtle speed, spheres and bloom, a night mode, and settings kept in the URL.',
    tags: ['React Three Fiber', 'Three.js', 'TypeScript'],
    url: 'https://marvinbaudach.github.io/aquarium/',
    position: [4, -0.5, 0],
    emissiveColor: '#c03000',
    accentColor: '#ff5020',
    geometry: 'icosahedron',
    floatSpeed: 1.6,
  },
  {
    id: 'observatory',
    title: 'Observatory',
    description: 'This project. Interactive 3D scene built with React Three Fiber: a nebula of domain-warped FBM noise, bloom postprocessing and camera flights to the projects.',
    tags: ['React Three Fiber', 'Three.js', 'GLSL'],
    url: 'https://marvinbaudach.github.io/observatory/',
    position: [0, 2.5, -2],
    emissiveColor: '#2040e0',
    accentColor: '#4488ff',
    geometry: 'octahedron',
    floatSpeed: 1.9,
  },
];
