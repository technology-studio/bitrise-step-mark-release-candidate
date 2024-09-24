import ky from 'ky';
import { execSync } from 'child_process';

import {
  getAndroidVersion,
  getIOSVersion,
} from './getAppVersions.js';

const ACCESS_TOKEN = process.env.GITHUB_ACCESS_TOKEN;
const COMMIT_SHA = process.env.COMMIT_SHA;
const REPO = process.env.REPO_SLUG;
const OWNER = process.env.REPO_OWNER;
const BUILD_NUMBER = process.env.BITRISE_BUILD_NUMBER;
const PLATFORM = process.env.APP_PLATFORM;
const DEPLOYMENT = process.env.DEPLOYMENT;

const api = ky.create({
  prefixUrl: 'https://api.github.com',
  headers: {
    'Authorization': `Bearer ${ACCESS_TOKEN}`,
    'Accept': 'application/vnd.github.v3+json',
    'X-GitHub-Api-Version': '2022-11-28',
  },
});

(async () => {
  if (COMMIT_SHA === "") {
    console.log("No commit SHA provided, skipping");
    return;
  }

  const appVersion = PLATFORM === "ios" ? getIOSVersion() : getAndroidVersion();
  if (appVersion === null) {
    console.log("No app version found, skipping");
    return;
  }
  const releaseCandidateTagName = `${PLATFORM}/${DEPLOYMENT}/${appVersion}-${BUILD_NUMBER}`;
  console.log(`Adding "${releaseCandidateTagName}" tag to ${COMMIT_SHA}...`);
  try {
    const tagResponse = await api.post(`repos/${OWNER}/${REPO}/git/tags`, {
      json: {
        tag: releaseCandidateTagName,
        message: "",
        object: COMMIT_SHA,
        type: "commit",
      },
    }).json();
    const tagSha = tagResponse.sha;
    await api.post(`repos/${OWNER}/${REPO}/git/refs`, {
      json: {
        ref: `refs/tags/${releaseCandidateTagName}`,
        sha: tagSha,
      },
    });
  } catch (error) {
    console.error("Failed to create or add release-candidate tag");
    process.exit(1);
  }

  const deliveredReleaseCandidateBranchName = `${PLATFORM}/release-candidate`;
  console.log(`Setting "${deliveredReleaseCandidateBranchName}" branch to ${COMMIT_SHA}...`);
  try {
    const branchExists = execSync(`git show-ref refs/heads/${deliveredReleaseCandidateBranchName}`).toString().trim() !== "";
    if (!branchExists) {
      console.log(`Creating "${deliveredReleaseCandidateBranchName}" branch...`);
      execSync(`git branch ${deliveredReleaseCandidateBranchName} ${COMMIT_SHA}`);
    } else {
      console.log(`Updating "${deliveredReleaseCandidateBranchName}" branch...`);
      execSync(`git update-ref refs/heads/${deliveredReleaseCandidateBranchName} ${COMMIT_SHA}`);
    }
    execSync(`git push origin ${deliveredReleaseCandidateBranchName}`);
  } catch (error) {
    console.error("Failed to update release-candidate branch");
    process.exit(1);
  }
})();
