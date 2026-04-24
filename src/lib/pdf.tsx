import React from 'react';
import { Page, Text, View, Document, StyleSheet, renderToStream } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { flexDirection: 'column', backgroundColor: '#FFFFFF', padding: 36 },
  header: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#CBD5E1' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 4 },
  headerSub: { fontSize: 10, color: '#64748B', marginBottom: 2 },
  section: { marginTop: 14 },
  sectionTitle: { fontSize: 13, fontWeight: 'bold', marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', color: '#1E3A5F' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  label: { fontSize: 10, color: '#475569' },
  value: { fontSize: 10, fontWeight: 'bold' },
  listItem: { fontSize: 10, marginBottom: 4, paddingLeft: 8 },
  footer: { position: 'absolute', bottom: 24, left: 36, right: 36, textAlign: 'center', fontSize: 8, color: '#94A3B8' },
});

const Row = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.row}>
    <Text style={styles.label}>{label}</Text>
    <Text style={styles.value}>{value}</Text>
  </View>
);

const JobPDFDocument = ({
  data,
  calculatedMaterials,
  crewInstructions,
  laborItems,
  materialNotes,
}: {
  data: any;
  calculatedMaterials: any;
  crewInstructions: string[];
  laborItems: string[];
  materialNotes: string[];
}) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Roof Auto AI — Job Package</Text>
        <Text style={styles.headerSub}>Customer: {data?.customerName || 'N/A'}   |   Address: {data?.address || 'N/A'}</Text>
        <Text style={styles.headerSub}>Claim #: {data?.claimNumber || 'N/A'}   |   Insurance: {data?.insuranceCompany || 'N/A'}</Text>
        <Text style={styles.headerSub}>Date: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</Text>
      </View>

      {/* Section 1: Material Order Form */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>1. Material Order Form</Text>
        <Row label="Field Shingles (incl. 10% waste)" value={`${calculatedMaterials?.shingles || 0} SQ`} />
        <Row label="Hip & Ridge Shingles" value={`${calculatedMaterials?.ridgeCap || 0} bundles`} />
        <Row label="Starter Strip" value={`${calculatedMaterials?.starterStrip || 0} bundles`} />
        <Row label="Synthetic Underlayment" value={`${calculatedMaterials?.felt || 0} rolls`} />
        <Row label="Ice & Water Shield" value={`${calculatedMaterials?.iceAndWater || 0} rolls`} />
        <Row label="Drip Edge — Rake" value={`${calculatedMaterials?.dripEdgeRake || 0} pcs`} />
        <Row label="Drip Edge — Eave" value={`${calculatedMaterials?.dripEdgeEave || 0} pcs`} />
        <Row label="Pipe Jacks" value={`${calculatedMaterials?.pipeJacks || 0} ea`} />
        <Row label="Ridge Vent (4 ft sections)" value={`${calculatedMaterials?.ridgeVentSections || 0} sections`} />
        <Row label={'Coil Nails 1-1/4"'} value={`${calculatedMaterials?.coilNails || 0} cases`} />
        <Row label="Cap Nails (Plastic)" value={`${calculatedMaterials?.capNails || 0} boxes`} />
        <Row label="Geocel 2300 Sealant" value={`${calculatedMaterials?.sealant || 0} tubes`} />
        {materialNotes && materialNotes.length > 0 && (
          <View style={{ marginTop: 6 }}>
            {materialNotes.map((note, i) => (
              <Text key={i} style={[styles.listItem, { color: '#1D4ED8' }]}>* {note}</Text>
            ))}
          </View>
        )}
      </View>

      {/* Section 2: Crew Instructions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>2. Crew Instructions</Text>
        {crewInstructions && crewInstructions.length > 0 ? (
          crewInstructions.map((item, i) => (
            <Text key={i} style={styles.listItem}>{i + 1}. {item}</Text>
          ))
        ) : (
          <Text style={styles.listItem}>No specific crew instructions generated.</Text>
        )}
      </View>

      {/* Section 3: Labor Items */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>3. Labor Items</Text>
        {laborItems && laborItems.length > 0 ? (
          laborItems.map((item, i) => (
            <Text key={i} style={styles.listItem}>{i + 1}. {item}</Text>
          ))
        ) : (
          <Text style={styles.listItem}>No labor items generated.</Text>
        )}
      </View>

      {/* Roof Measurements Reference */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Roof Measurements (EagleView)</Text>
        <Row label="Squares" value={String(data?.squares || 0)} />
        <Row label="Pitch" value={String(data?.pitch || 'N/A')} />
        <Row label="Ridges" value={`${data?.ridges || 0} ft`} />
        <Row label="Hips" value={`${data?.hips || 0} ft`} />
        <Row label="Valleys" value={`${data?.valleys || 0} ft`} />
        <Row label="Rakes" value={`${data?.rakes || 0} ft`} />
        <Row label="Eaves" value={`${data?.eaves || 0} ft`} />
      </View>

      <Text style={styles.footer}>Generated by Roof Auto AI - Reliable Exteriors Group</Text>
    </Page>
  </Document>
);

export async function generatePDFBuffer(
  data: any,
  calculatedMaterials: any,
  crewInstructions: string[] = [],
  laborItems: string[] = [],
  materialNotes: string[] = []
): Promise<Buffer> {
  const stream = await renderToStream(
    <JobPDFDocument
      data={data}
      calculatedMaterials={calculatedMaterials}
      crewInstructions={crewInstructions}
      laborItems={laborItems}
      materialNotes={materialNotes}
    />
  );
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('error', (err) => reject(err));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}
