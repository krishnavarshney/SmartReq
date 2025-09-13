
# SmartReq: The Intelligent API Client

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![React Version](https://img.shields.io/badge/react-19-blue?logo=react)
![TypeScript](https://img.shields.io/badge/typescript-5.2-blue?logo=typescript)

A next-generation, browser-based API client designed for developers, analysts, and QA teams. SmartReq moves beyond simple requests, offering a powerful suite for single-request debugging, high-performance bulk processing, and intelligent, combinatorial request body generation.

![SmartReq Demo](https://storage.googleapis.com/aistudio-hosting/readme-assets/api-client-demo.gif)

---

## ✨ Key Features

This platform is packed with professional-grade features designed to streamline your API testing and data processing workflows.

### 🚀 Core Functionality
*   **Full-Featured Request Composer:** Craft any HTTP request with support for `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, and more.
*   **Intuitive Parameter & Header Editing:** A dynamic key-value editor that makes managing query parameters and headers effortless.
*   **Comprehensive Auth Support:** Built-in helpers for **Bearer Token**, **Basic Auth**, and **API Key** authentication.
*   **Flexible Request Bodies:** Support for **JSON** (with validation), **Form-Data**, and **x-www-form-urlencoded**.
*   **Pre-request & Test Scripting:** Leverage JavaScript scripting to manipulate request data or assert response conditions.

### 📊 Intelligent Response Handling
*   **Multi-View Response Inspector:** Analyze response bodies in different formats:
    *   **Raw View:** Syntax-highlighted text with search and word-wrap.
    *   **Hierarchical Table View:** A powerful, recursive, and **collapsible table** for navigating complex JSON responses.
    *   **HTML Preview:** Render HTML responses in a sandboxed iframe.
*   **Drill-Down Navigation:** Seamlessly promote any nested JSON object or array into its own dedicated, filterable table view with breadcrumb navigation.
*   **Data Export:** Export table data to **CSV** or **XLS** with a single click.

### ⚡ Advanced Bulk Mode
A dedicated workspace for running data-driven API tests at scale.
*   **Versatile Data Input:** Populate your run with data by **uploading CSV/JSON files**, **pasting raw data**, or using the integrated spreadsheet editor.
*   **Dynamic Request Templating:** Use `{{variable}}` syntax in your URL, headers, and body to inject data from your input source into each request.
*   **High-Performance Execution:**
    *   Run up to **50 requests in parallel** with the concurrency controller.
    *   Throttle requests with a configurable **delay** to respect API rate limits.
    *   **Live monitoring** dashboard with real-time progress, success/error counts, and requests per second.
    *   Full execution control with **Pause, Resume, and Stop** buttons.
*   **Rich Results Analysis:**
    *   A sortable and filterable master results grid.
    *   **Drill-down** into any individual result to see the full request/response pair.
    *   Visualize the run with an aggregated **summary chart** of status codes.
    *   **Export Consolidated Data:** Download a "flattened" CSV of the entire run, where nested JSON responses are expanded into their own columns for easy analysis.

### 🤖 Intelligent Body Builder
The ultimate tool for generating complex, combinatorial test data.
*   **Generate Data from JSON:** Use your request's JSON body as a template to generate hundreds of unique request bodies.
*   **Multi-Value Variables:** Select keys to act as variables and provide multiple values for each.
*   **Visual Dependency Engine:** Create dynamic relationships where one field's value is templated based on others (e.g., `description: "Profile for {{name}}"`).
*   **Live Preview:** See a real-time preview of all generated combinations before running.
*   **Seamless Bulk Mode Integration:** Send your generated data directly to the Bulk Mode data grid with a single click.

### 🖥️ Professional Workspace
*   **Flexible Layouts:** Instantly switch between a **vertical (top/bottom)** or **horizontal (side-by-side)** view for the request and response panels.
*   **Fully Responsive:** The entire interface is optimized for both desktop and mobile devices.
*   **Persistent History:** All single and bulk runs are saved. Bulk runs are consolidated into a single entry for a clean history log. Clicking an entry restores the entire workspace to its previous state.
*   **Global Environments:** Manage and use global variables across all your requests.
*   **Light & Dark Themes:** Choose your preferred look or sync with your system settings.

---

## 🚀 How to Use

The application is designed to be intuitive, with two primary modes of operation.

### Single Request Mode

1.  **Compose:** Use the main request panel to set the HTTP Method and URL.
2.  **Detail:** Use the tabs below (Params, Authorization, Headers, Body) to configure the request details.
3.  **Send:** Click the "Send" button.
4.  **Analyze:** View the response in the panel on the right. Use the Raw, Table, or Preview views to inspect the data.

### Bulk Mode Walkthrough (Example)

1.  **Switch to Bulk Mode:** Click the "Bulk Mode" button.
2.  **Provide Data:** In the **Data Source** panel, click "Paste from Clipboard" and paste the following CSV data:
    ```csv
    category,amount
    Programming,2
    Pun,1
    ```
3.  **Set Template:** In the request panel on the right, set the method to `GET` and the URL to:
    ```
    https://v2.jokeapi.dev/joke/{{category}}?amount={{amount}}
    ```
4.  **Execute:** In the bottom panel, click **Start Run**.
5.  **Analyze:** Watch the results populate in real-time. Click any result row to drill down into the full request/response details.

---

## 🛠️ Technology Stack

*   **Frontend:** [React 19](https://react.dev/) & [TypeScript](https://www.typescriptlang.org/)
*   **Styling:** [Tailwind CSS](https://tailwindcss.com/) for a utility-first styling approach.
*   **Icons:** [Lucide React](https://lucide.dev/) for a beautiful and consistent icon set.
*   **Data Parsing:** [PapaParse](https://www.papaparse.com/) for robust CSV handling.
*   **UI Interactivity:** [Re-resizable](https://github.com/bokuweb/re-resizable) for panel resizing.

---

## 🤝 Contributing

Contributions are welcome! If you have suggestions for improvements or find a bug, please feel free to open an issue or submit a pull request.

1.  Fork the repository.
2.  Create your feature branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4.  Push to the branch (`git push origin feature/AmazingFeature`).
5.  Open a Pull Request.

---

## 📄 License

This project is licensed under the MIT License.