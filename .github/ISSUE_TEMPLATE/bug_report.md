name: 🐛 Bug Report
description: Report a bug or unexpected behavior
title: ""
labels: ["Bug 🐛"]
body:
  - type: markdown
    attributes:
      value: |
        Thanks for reporting a bug! Please fill out the details below.
  - type: input
    id: version
    attributes:
      label: App Version
      placeholder: e.g. 1.2.3
    validations:
      required: true
  - type: textarea
    id: description
    attributes:
      label: Describe the bug
      placeholder: What happened? What did you expect to happen?
    validations:
      required: true
  - type: textarea
    id: steps
    attributes:
      label: Steps to Reproduce
      placeholder: |
        1. Open the app
        2. Click on 'X'
        3. Observe crash
    validations:
      required: false
  - type: dropdown
    id: os
    attributes:
      label: Operating System
      options:
        - Windows
        - macOS
        - Linux
        - Other
    validations:
      required: true