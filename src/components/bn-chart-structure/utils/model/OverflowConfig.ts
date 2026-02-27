export interface OverflowConfig {
  cutWidth: number; // Max bar width in px before overdrive kicks in (AC scenarios)
  overdriveZoneWidth: number; // Total overdrive zone width in px
  breakGap: number; // Break indicator gap in px
  maxOverflow: number; // Largest overflow amount (px) among all bars
  scenarioCutOffset: number; // Non-AC scenarios break this many px narrower than AC
}
