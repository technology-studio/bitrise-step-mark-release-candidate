import path from 'path';
import { execSync } from 'child_process';
import fs from 'fs';
const projectDir = process.env.BITRISE_SOURCE_DIR;

export const getIOSVersion = () => {
  try {
    // Change to the iOS directory
    process.chdir(path.join(projectDir, 'ios'));

    // First, try to get the raw version string
    let version = execSync('agvtool what-marketing-version -terse1', { encoding: 'utf8' }).trim();
    console.log(`Version from agvtool: ${version}`);

    // If the version is a variable reference, try to resolve it
    if (version.startsWith('$')) {
      // Try to resolve using xcodebuild
      try {
        const buildSettings = execSync('xcodebuild -showBuildSettings', { encoding: 'utf8' });
        const match = buildSettings.match(/MARKETING_VERSION = ([\d.]+)/);
        if (match) {
          version = match[1];
          console.log(`Version from xcodebuild: ${version}`);
        }
      } catch (xcodebuildError) {
        console.error('Error running xcodebuild:', xcodebuildError);
      }

      // If xcodebuild didn't work, try parsing xcconfig files
      if (version.startsWith('$')) {
        const xconfigFiles = fs.readdirSync('.').filter(file => file.endsWith('.xcconfig'));
        for (const file of xconfigFiles) {
          const content = fs.readFileSync(file, 'utf8');
          const match = content.match(/MARKETING_VERSION *= *([\d.]+)/);
          if (match) {
            version = match[1];
            console.log(`Version from xcconfig: ${version}`);
            break;
          }
        }
      }
    }

    const finalVersion = version.startsWith('$') ? null : version;
    return finalVersion;
  } catch (error) {
    console.error('Error getting iOS version:', error);
    return null;
  } finally {
    process.chdir(projectDir);
  }
}

export const getAndroidVersion = () => {
  const gradlePath = path.join(projectDir, 'android', 'app', 'build.gradle');
  try {
    const content = fs.readFileSync(gradlePath, 'utf8');
    const match = content.match(/versionName "([\d.]+)"/);
    return match ? match[1] : null;
  } catch (error) {
    console.error('Error reading Android build.gradle file:', error);
    return null;
  }
}
