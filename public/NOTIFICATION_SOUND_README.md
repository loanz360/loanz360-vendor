# Notification Sound Setup

## Required Sound File

**File Name:** `notification-sound.mp3`
**Location:** `/public/notification-sound.mp3`

## Specifications

- **Format:** MP3 (for maximum browser compatibility)
- **Duration:** 1-2 seconds (short and pleasant)
- **Volume:** Normalized to -20dB (will be set to 50% in code)
- **Sample Rate:** 44.1kHz
- **Bit Rate:** 128kbps minimum

## Recommended Sounds

### Option 1: Subtle Notification (Recommended)
- Gentle bell chime
- Not intrusive
- Pleasant tone
- Example: Similar to iOS "Tri-tone" or Android "Pixie Dust"

### Option 2: Professional Alert
- Single beep tone (440Hz)
- Clean and professional
- Example: Similar to Slack notification sound

### Option 3: Friendly Notification
- Soft "ding" sound
- Warm and welcoming
- Example: Similar to Microsoft Teams notification

## Where to Get Notification Sounds

### Free Sources:
1. **Freesound.org** - https://freesound.org/search/?q=notification
   - Filter by: Creative Commons 0 license
   - Search: "notification", "bell", "chime", "ding"

2. **Zapsplat** - https://www.zapsplat.com/sound-effect-categories/notification-sounds/
   - Free for commercial use with attribution

3. **Mixkit** - https://mixkit.co/free-sound-effects/notification/
   - Free for commercial use, no attribution required

4. **NotificationSounds.com** - https://notificationsounds.com/
   - Free notification sounds specifically designed for apps

### Creating Custom Sound:

If you want to create a custom sound:

\`\`\`bash
# Using Audacity (free audio editor):
1. Generate > Tone
2. Frequency: 440Hz (A note) or 523Hz (C note)
3. Amplitude: 0.8
4. Duration: 0.5 seconds
5. Add fade in/out (50ms each)
6. Export as MP3 (128kbps)
\`\`\`

## Installation Steps

1. **Download or create the sound file**
2. **Rename it to:** `notification-sound.mp3`
3. **Place it in:** `/public/notification-sound.mp3`
4. **Verify it works:**
   - Open browser console
   - Run: `new Audio('/notification-sound.mp3').play()`
   - You should hear the sound

## Usage in Code

The notification bell component is already configured to use this file:

\`\`\`typescript
// src/components/notifications/notification-bell.tsx:106-117
const playNotificationSound = () => {
  try {
    const audio = new Audio('/notification-sound.mp3')
    audio.volume = 0.5 // 50% volume
    audio.play().catch(() => {
      // Ignore errors (browser may block autoplay)
    })
  } catch (error) {
    // Ignore sound errors
  }
}
\`\`\`

## Browser Compatibility

✅ Chrome/Edge: Full support
✅ Firefox: Full support
✅ Safari: Full support
⚠️ Mobile browsers: May require user interaction first (autoplay policy)

## Testing

After adding the file, test with:

1. **Manual Test:**
   - Navigate to notification page
   - Have someone send you a notification
   - Should hear the sound

2. **Browser Console Test:**
   \`\`\`javascript
   const audio = new Audio('/notification-sound.mp3')
   audio.volume = 0.5
   audio.play()
   \`\`\`

3. **Volume Test:**
   - Sound should be audible but not jarring
   - Test on different devices (desktop, mobile)
   - Adjust volume in code if needed (currently 0.5 = 50%)

## User Preference

Users can disable notification sounds via preferences (to be implemented):

\`\`\`typescript
// src/lib/notifications/notification-types.ts
export interface NotificationPreferences {
  sound_enabled: boolean // User can toggle this
  // ... other preferences
}
\`\`\`

## Fallback

If the sound file is missing:
- ✅ Code handles gracefully (try-catch)
- ✅ No errors in console
- ✅ Notifications still work (just without sound)
- ⚠️ Console will show: "GET /notification-sound.mp3 404 (Not Found)"

## Alternative: Multiple Sounds

For different notification types, you can add multiple sound files:

\`\`\`
/public/sounds/
├── notification-default.mp3     (default sound)
├── notification-urgent.mp3      (for urgent priority)
├── notification-success.mp3     (for success messages)
└── notification-alert.mp3       (for alerts)
\`\`\`

Then update the playNotificationSound function to select based on priority:

\`\`\`typescript
const playNotificationSound = (priority: string = 'normal') => {
  const soundMap = {
    urgent: '/sounds/notification-urgent.mp3',
    high: '/sounds/notification-alert.mp3',
    normal: '/sounds/notification-default.mp3',
    low: '/sounds/notification-default.mp3'
  }

  const audio = new Audio(soundMap[priority] || soundMap.normal)
  audio.volume = 0.5
  audio.play().catch(() => {})
}
\`\`\`

## Recommended Download

**Quick Start:**
Download this free notification sound:
https://freesound.org/people/Leszek_Szary/sounds/171670/

- **Name:** "Ding Sound Effect"
- **License:** CC0 (Public Domain)
- **Perfect for:** General notifications
- **Professional and non-intrusive**

## File Size

Keep the file small for faster loading:
- ✅ Target: < 50KB
- ✅ Maximum: 100KB
- ⚠️ Avoid: > 200KB (unnecessary for short sound)

## Production Deployment

Before deploying to production:
1. ✅ Add the sound file
2. ✅ Test on all major browsers
3. ✅ Test on mobile devices
4. ✅ Verify file loads quickly (check Network tab)
5. ✅ Consider CDN for better performance

## Notes

- Sound file is **optional** but **highly recommended** for better UX
- Without it, notifications work fine, just without audio feedback
- Mobile browsers have strict autoplay policies (sound may not play until user interacts)
- Always respect user preferences (allow disabling sound)

---

**Status:** 🔴 Sound file not yet added
**Next Step:** Download and add `notification-sound.mp3` to `/public/` folder
