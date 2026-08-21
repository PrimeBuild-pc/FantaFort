<div align="center">
  <img src="docs/assets/fantafort-banner.png" alt="FantaFort — competitive Fortnite fantasy experience" width="100%" />

  <h1>FantaFort</h1>

  <p><strong>An independent fantasy platform built around competitive Fortnite tournament results.</strong></p>

  <img src="docs/assets/live-data.svg" alt="Alpha with live tournament data" width="760" />

  <p>
    <a href="https://github.com/PrimeBuild-pc/FantaFort/commits/main"><img alt="Last commit" src="https://img.shields.io/github/last-commit/PrimeBuild-pc/FantaFort?style=plastic&amp;logo=git&amp;logoColor=white"></a>
    <a href="https://github.com/PrimeBuild-pc/FantaFort/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/PrimeBuild-pc/FantaFort?style=plastic&amp;logo=github"></a>
    <a href="https://github.com/PrimeBuild-pc/FantaFort/issues"><img alt="Open issues" src="https://img.shields.io/github/issues/PrimeBuild-pc/FantaFort?style=plastic&amp;logo=github"></a>
  </p>
  <p>
    <a href="https://fantafort.com"><img alt="Website" src="https://img.shields.io/badge/website-fantafort.com-00d8ff?style=plastic"></a>
    <a href="https://github.com/PrimeBuild-pc/FantaFort/actions/workflows/revival-ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/PrimeBuild-pc/FantaFort/revival-ci.yml?branch=main&amp;style=plastic&amp;logo=githubactions&amp;label=CI"></a>
    <a href="https://github.com/PrimeBuild-pc/FantaFort/actions/workflows/codeql.yml"><img alt="CodeQL" src="https://img.shields.io/github/actions/workflow/status/PrimeBuild-pc/FantaFort/codeql.yml?branch=main&amp;style=plastic&amp;logo=github&amp;label=CodeQL"></a>
    <img alt="Alpha" src="https://img.shields.io/badge/status-alpha-f59e0b?style=plastic">
    <img alt="Proprietary license" src="https://img.shields.io/badge/license-proprietary-8b5cf6?style=plastic">
  </p>
  <p>
    <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-6-3178C6?style=plastic&amp;logo=typescript&amp;logoColor=white">
    <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-111111?style=plastic&amp;logo=nextdotjs&amp;logoColor=white">
    <img alt="React" src="https://img.shields.io/badge/React-19-087EA4?style=plastic&amp;logo=react&amp;logoColor=white">
    <img alt="Supabase" src="https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=plastic&amp;logo=supabase&amp;logoColor=white">
    <a href="SECURITY.md"><img alt="Security policy" src="https://img.shields.io/badge/security-policy-2ea44f?style=plastic&amp;logo=github"></a>
  </p>
</div>

---

## About

FantaFort is a multilingual fantasy experience for following competitive Fortnite. It combines private leagues, fantasy rosters, virtual markets, tournament scoring, standings, strategy mechanics, social features and player-performance insights in one independent product.

The project is under active development and currently operates as a **limited alpha**. Virtual balances, top-ups and rewards are sandbox features only: they have no monetary value, cannot be purchased or cashed out, and do not represent gambling, betting or a financial product.

> [!IMPORTANT]
> FantaFort is an independent project. It is not endorsed by, affiliated with, authorized by or sponsored by Epic Games, Inc. Fortnite and related names, trademarks and assets belong to their respective owners.

## Data and external services

FantaFort uses documented public APIs and third-party infrastructure to provide tournament data and operate the hosted service. Competitive data is currently sourced from the public Osirion API. Selected contextual player information may be attributed to its original public source.

Availability through a public API does not transfer ownership of third-party data or grant redistribution rights. External services, data, trademarks, photographs and other materials remain governed by their respective owners, licenses and terms. Their availability, accuracy and continuity are outside FantaFort's control. See [Third-Party Notices](THIRD_PARTY_NOTICES.md).

## Alpha and security notice

> [!WARNING]
> **Alpha software may fail, change or lose data.** Security controls are actively being implemented, tested and hardened, but no system can be guaranteed secure. FantaFort does not warrant uninterrupted availability or the absolute confidentiality, integrity or preservation of accounts, sessions, profile information or user-generated data.

Use the alpha only with non-sensitive information and unique credentials that are not reused elsewhere. Do not store valuable, confidential or irreplaceable information in the service. Access may be limited, reset or withdrawn while development and security work continue.

To the maximum extent permitted by applicable law, the service and repository are provided **"as is"** and **"as available"**, without warranties of merchantability, fitness for a particular purpose, non-infringement, availability, accuracy or security. Nothing in this notice excludes rights, duties or liabilities that cannot lawfully be excluded.

Security concerns must be reported privately under the [Security Policy](SECURITY.md). A public repository does not authorize testing against production, other users, providers or third-party systems.

## Proprietary rights — no license granted

**Copyright © 2026 FantaFort. All rights reserved.**

FantaFort's original source code, software architecture, product design, user experience, documentation, graphics, branding, creative expression, selection and arrangement of content, and other original materials are proprietary. Publication or public visibility of this repository is for transparency and review only. It is not a dedication to the public domain and does not grant an open-source license.

Unless the copyright holder gives prior written permission, no person or organization may copy, reproduce, modify, translate, adapt, publish, distribute, sublicense, sell, commercially exploit, host, deploy, mirror, create derivative works from, reverse engineer, use to build a competing or substantially similar product, or use the original materials for machine-learning or generative-AI training.

GitHub's platform-level rights to display and technically operate a public repository apply only as required by GitHub's terms. They do not create a downstream license to use the project. Unauthorized use may result in takedown requests and the pursuit of available contractual, copyright, trademark or other legal remedies.

Abstract ideas and third-party materials are protected only to the extent provided by applicable law and their respective owners. Repository visibility does not alter the ownership of FantaFort's original implementation or waive any right not expressly granted. See the [Proprietary License](LICENSE) for the controlling terms.

## Community

- Official Discord: <https://discord.gg/V3m8pDe3wz> — beta feedback, bug reports, suggestions and game discussion.
- Product/community email updates are opt-in only (`community_email_opt_in`, default off) and can be managed from Account settings. No campaign emails are sent in this release; a future campaign system would require a separate reviewed plan and provider.
- Global net-worth leaderboard: account coins plus current portfolio market value. Only public data (nickname, rank, net worth, public badges) is shown; see `docs/PRODUCT_COMMUNITY_LEADERBOARD_PLAN.md`.

## Legal documents

<table>
  <tr>
    <td><strong><a href="LICENSE">Proprietary License</a></strong></td>
    <td>All-rights-reserved terms and warranty disclaimer.</td>
  </tr>
  <tr>
    <td><strong><a href="SECURITY.md">Security Policy</a></strong></td>
    <td>Private vulnerability reporting and testing boundaries.</td>
  </tr>
  <tr>
    <td><strong><a href="THIRD_PARTY_NOTICES.md">Third-Party Notices</a></strong></td>
    <td>External services, data, images and trademarks.</td>
  </tr>
  <tr>
    <td><strong><a href="https://fantafort.com/terms">Terms</a></strong></td>
    <td>Rules governing use of the hosted alpha.</td>
  </tr>
  <tr>
    <td><strong><a href="https://fantafort.com/privacy">Privacy</a></strong></td>
    <td>Information about account and service data.</td>
  </tr>
</table>

---

<div align="center">
  <strong>FantaFort is proprietary alpha software. No reuse rights are granted.</strong><br />
  <sub>Independent project · Not endorsed by Epic Games</sub>
</div>
