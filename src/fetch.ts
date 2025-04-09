import fs from 'fs';
import path from 'path';
import { stringify } from 'csv-stringify';
const API_URL = 'https://www.data-openblocklabs.com/sonic/protocol-points-stats?page=1&size=1000';
const DATA_FILE = path.join(__dirname, '../data/sonic_data.json');

// ---- Types ---- //

interface ProtocolEntry {
    protocol: string;
    category: string;
    protocol_gem_score: number;
    protocol_total_gems: number;
}

interface EnrichedProtocolEntry extends ProtocolEntry {
    share: number;
}

interface Snapshot {
    timestamp: string;
    totalGemScore: number;
    data: EnrichedProtocolEntry[];
}

// ---- Fetch, compute, store ---- //

async function fetchData() {
    const res = await fetch(API_URL);
    console.log(res);
    const rawData: ProtocolEntry[] = (await res.json()) as ProtocolEntry[];
    const timestamp = new Date().toISOString();

    const totalGemScore = rawData.reduce((sum, entry) => sum + entry.protocol_gem_score, 0);

    const enrichedData: EnrichedProtocolEntry[] = rawData.map((entry) => ({
        ...entry,
        share: totalGemScore > 0 ? (entry.protocol_gem_score / totalGemScore) * 100 : 0,
    }));

    const newSnapshot: Snapshot = {
        timestamp,
        totalGemScore,
        data: enrichedData,
    };

    let existingSnapshots: Snapshot[] = [];
    if (fs.existsSync(DATA_FILE)) {
        const fileData = fs.readFileSync(DATA_FILE, 'utf-8');
        existingSnapshots = JSON.parse(fileData);
    }

    existingSnapshots.push(newSnapshot);
    fs.writeFileSync(DATA_FILE, JSON.stringify(existingSnapshots, null, 2));

    const csvData = enrichedData.map((entry) => ({
        timestamp, // Add timestamp to each entry
        protocol: entry.protocol,
        category: entry.category,
        protocol_gem_score: entry.protocol_gem_score,
        protocol_total_gems: entry.protocol_total_gems,
        share: entry.share,
    }));

    // Generate the CSV file
    stringify(csvData, { header: true }, (err, output) => {
        if (err) {
            console.error('Error generating CSV', err);
        } else {
            const csvFilePath = path.join(__dirname, '../data/latest.csv');
            fs.writeFileSync(csvFilePath, output);
            console.log(`✅ CSV file updated at ${csvFilePath}`);
        }
    });

    console.log(`✅ Saved ${enrichedData.length} entries for ${timestamp}`);
}

fetchData().catch((err) => {
    console.error('❌ Error fetching data:', err);
});
