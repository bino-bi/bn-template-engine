export interface OverflowConfig {
  cutHeight: number;           // Max bar height in px before overdrive kicks in (AC scenarios)
  overdriveZoneHeight: number; // Total overdrive zone height in px
  breakGap: number;            // Break indicator gap in px
  maxOverflow: number;         // Largest overflow amount (px) among all bars
  scenarioCutOffset: number;   // Non-AC scenarios break this many px lower than AC
}
