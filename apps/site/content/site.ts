export const site = {
  headline:
    "Control your TV from one desktop workflow with shortcuts, media actions, and explicit device targeting.",
  subhead:
    "Sendo is a Windows desktop utility for Fire TV control, Spotify routing, reusable shortcuts, and local execution flows.",
  principles: [
    {
      title: "Local-first",
      body: "Config, auth state, and execution stay on your machine.",
    },
    {
      title: "Explicit targeting",
      body: "Playback actions stay bound to the device you selected.",
    },
    {
      title: "Reusable flows",
      body: "Favorites, tray actions, and hotkeys compress repeated routines.",
    },
  ],
  flow: [
    "Wake the TV",
    "Launch apps",
    "Route playback",
    "Reuse with shortcuts",
  ],
  features: [
    "Fire TV control over ADB",
    "Spotify Connect routing",
    "Persistent shortcuts",
    "Global hotkeys",
    "Tray actions",
    "Startup to tray",
    "Readiness checks",
    "Quick access actions",
  ],
  installSteps: [
    "Install Sendo on Windows and confirm adb works from a new PowerShell window.",
    "Enable ADB debugging on your Fire TV and approve the first connection prompt.",
    "Add the Fire TV IP address in Sendo, then test the ADB connection.",
    "Connect Spotify with developer app credentials and the expected redirect URL.",
    "Select the exact Spotify Connect target device before running an action.",
    "Run Start Spotify on TV and save it as a shortcut if you want.",
  ],
  troubleshooting: [
    {
      title: "ADB not connected",
      body: "Check that adb is on PATH, the TV is on the same network, ADB debugging is enabled, and the TV accepted the authorization prompt.",
    },
    {
      title: "Wrong Spotify device",
      body: "Open Spotify in Sendo and pick the explicit target device instead of relying on whatever Spotify marked as current.",
    },
    {
      title: "Spotify auth fails",
      body: "Confirm the client ID, client secret, and redirect URL match the Spotify Developer app exactly.",
    },
    {
      title: "Auth expired",
      body: "Use the Spotify page to re-authenticate and refresh the cached token state.",
    },
    {
      title: "Startup and tray behavior",
      body: "Use the General page in the desktop app to control launch-at-startup and start-minimized-to-tray behavior.",
    },
  ],
  links: {
    github: "https://github.com/postigodev/sendo",
    portfolio: "https://postigo.sh",
    linkedin: "https://linkedin.com/in/postigo",
    release:
      "https://github.com/postigodev/sendo/releases/latest",
  },
} as const;
