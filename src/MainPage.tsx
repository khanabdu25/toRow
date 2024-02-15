import { useState, ChangeEvent, useMemo } from "react";
import * as XLSX from "xlsx";
import { MaterialReactTable } from "material-react-table";

type DataEntry = {
  record_id: string;
  redcap_event_name: string;
  phq_timestamp: string;
  phq_score: number;
};

type ConsolidatedData = {
  record_id: string;
  [key: string]: string | number;
};

type TableColumn = {
  accessorKey: string;
  header: string;
};

export default function MainPage() {
  const [file, setFile] = useState<File | null>(null);
  const [jsonData, setJsonData] = useState<ConsolidatedData[]>([]);
  const [columns, setColumns] = useState<TableColumn[]>([]);

  function excelSerialDateToJSDate(serial: number): Date {
    const utc_days = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400;
    const date = new Date(utc_value * 1000);

    // Add the timezone offset to the date
    const offset = date.getTimezoneOffset() * 60000; // offset in milliseconds
    const correctDate = new Date(date.getTime() + offset);

    return correctDate;
  }

  function formatDate(dateString: any): string {
    // Convert to string if it's not already
    const strDate = String(dateString);

    const datePattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/; // Pattern to match the date format "month/day/year"
    const match = strDate.match(datePattern);
    if (match) {
      // If the date string matches the expected format, reformat it.
      return `${match[3]}-${match[1].padStart(2, "0")}-${match[2].padStart(
        2,
        "0"
      )}`; // Formats to "year-month-day"
    } else {
      // If the date string does not match, return it as is.
      return strDate;
    }
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files ? e.target.files[0] : null;
    setFile(file);
  };

  const handleFileProcess = () => {
    if (!file) return;

    const reader = new FileReader();
    // ...

    reader.onload = (e: ProgressEvent<FileReader>) => {
      const buffer = e.target?.result as ArrayBuffer;
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const worksheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[worksheetName];
      const data: DataEntry[] = XLSX.utils.sheet_to_json(worksheet, {
        raw: true,
      });
      const processedData = preprocessData(data);
      setJsonData(processedData);
      saveProcessedData(processedData);
    };

    // ...

    reader.readAsArrayBuffer(file);
  };

  function preprocessData(data: DataEntry[]): ConsolidatedData[] {
    const groupedData: { [key: string]: DataEntry[] } = {};

    data.forEach((entry) => {
      if (!groupedData[entry.record_id]) {
        groupedData[entry.record_id] = [];
      }
      const entryCopy = { ...entry };
      if (typeof entry.phq_timestamp === "number") {
        // Convert Excel serial date to JavaScript Date object
        const date = excelSerialDateToJSDate(entry.phq_timestamp);
        // Format the date as month/day/year string
        entryCopy.phq_timestamp =
          date.getMonth() + 1 + "/" + date.getDate() + "/" + date.getFullYear();
      }
      groupedData[entry.record_id].push(entryCopy);
    });

    return Object.entries(groupedData).map(([recordId, entries]) => {
      const rowData: ConsolidatedData = { record_id: recordId };
      entries.forEach((entry, index) => {
        rowData[`redcap_event_name${index + 1}`] = entry.redcap_event_name;
        if (index == 1) console.log("entry is: " + entry.phq_timestamp);
        rowData[`phq_timestamp${index + 1}`] = entry.phq_timestamp;
        rowData[`phq_score${index + 1}`] = entry.phq_score;
      });
      return rowData;
    });
  }

  function saveProcessedData(data: ConsolidatedData[]): void {
    // Determine the maximum number of entries for any record_id
    const maxEntries =
      data.reduce((max, item) => {
        const entryCount = Object.keys(item).length - 1; // subtract the record_id field
        return entryCount > max ? entryCount : max;
      }, 0) / 3; // divide by 3 because each entry has 3 fields (event, timestamp, score)

    // Create headers
    const headers = ["record_id"];
    for (let i = 0; i < maxEntries; i++) {
      headers.push(
        `redcap_event_name${i + 1}`,
        `phq_timestamp${i + 1}`,
        `phq_score${i + 1}`
      );
    }

    // Transform data to match headers
    const transformedData = data.map((entry) => {
      const rowData: { [key: string]: string | number } = {
        record_id: entry.record_id,
      };
      for (let i = 1; i <= maxEntries; i++) {
        // Format date strings before adding them to rowData
        rowData[`redcap_event_name${i}`] = entry[`redcap_event_name${i}`] || 0;
        rowData[`phq_timestamp${i}`] = entry[`phq_timestamp${i}`]
          ? formatDate(entry[`phq_timestamp${i}`] as string)
          : "";
        rowData[`phq_score${i}`] = entry[`phq_score${i}`] || 0;
      }
      return rowData;
    });

    const newWorksheet = XLSX.utils.json_to_sheet(transformedData, {
      header: headers,
      skipHeader: false,
    });
    const newWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, "ProcessedData");

    // Create a temporary anchor element to trigger download
    const tempDownloadUrl = window.URL.createObjectURL(
      new Blob([XLSX.write(newWorkbook, { type: "array", bookType: "xlsx" })], {
        type: "application/octet-stream",
      })
    );

    const anchor = document.createElement("a");
    anchor.href = tempDownloadUrl;
    anchor.download = "ProcessedData.xlsx";
    document.body.appendChild(anchor);
    anchor.click();

    window.URL.revokeObjectURL(tempDownloadUrl);
    anchor.remove();

    // Generate column definitions
    const columnDefs: TableColumn[] = headers.map((header) => ({
      accessorKey: header,
      header,
    }));

    setColumns(columnDefs);
    setJsonData(data);
  }

  const memoizedColumns = useMemo(() => columns, [columns]);

  return (
    <div style={{ height: "100%" }}>
      <input type="file" accept=".xlsx, .xls" onChange={handleFileChange} />
      <button onClick={handleFileProcess} disabled={!file}>
        Process and Download File
      </button>

      {jsonData.length > 0 && (
        <MaterialReactTable
          columns={memoizedColumns}
          data={jsonData}
          // other props you might need
        />
      )}
    </div>
  );
}
