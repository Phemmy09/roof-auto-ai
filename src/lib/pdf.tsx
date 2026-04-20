import React from 'react';
import { Page, Text, View, Document, StyleSheet, renderToStream } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { flexDirection: 'column', backgroundColor: '#FFFFFF', padding: 30 },
  section: { margin: 10, padding: 10 },
  title: { fontSize: 24, marginBottom: 10, fontWeight: 'bold' },
  subtitle: { fontSize: 16, marginBottom: 5, marginTop: 15, textDecoration: 'underline' },
  text: { fontSize: 12, marginBottom: 5 },
});

const JobPDFDocument = ({ data, calculatedMaterials }: { data: any, calculatedMaterials: any }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.section}>
        <Text style={styles.title}>Materials Order & Crew Summary</Text>
        <Text style={styles.text}>Customer: {data?.customerName || 'N/A'}</Text>
        <Text style={styles.text}>Address: {data?.address || 'N/A'}</Text>
        <Text style={styles.text}>Claim No: {data?.claimNumber || 'N/A'}</Text>
        <Text style={styles.text}>Insurance: {data?.insuranceCompany || 'N/A'}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.subtitle}>Extracted Roof Measurements</Text>
        <Text style={styles.text}>Squares: {data?.squares || 0}</Text>
        <Text style={styles.text}>Pitch: {data?.pitch || 'N/A'}</Text>
        <Text style={styles.text}>Ridges: {data?.ridges || 0} ft</Text>
        <Text style={styles.text}>Hips: {data?.hips || 0} ft</Text>
        <Text style={styles.text}>Valleys: {data?.valleys || 0} ft</Text>
        <Text style={styles.text}>Rakes: {data?.rakes || 0} ft</Text>
        <Text style={styles.text}>Eaves: {data?.eaves || 0} ft</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.subtitle}>Final Calculated Materials</Text>
        <Text style={styles.text}>Shingles: {calculatedMaterials?.shingles || 0} squares</Text>
        <Text style={styles.text}>Felt Underlayment: {calculatedMaterials?.felt || 0} rolls</Text>
        <Text style={styles.text}>Ice & Water Shield: {calculatedMaterials?.iceAndWater || 0} rolls</Text>
        <Text style={styles.text}>Ridge Cap: {calculatedMaterials?.ridgeCap || 0} bundles</Text>
        <Text style={styles.text}>Drip Edge: {calculatedMaterials?.dripEdge || 0} pieces</Text>
        <Text style={styles.text}>Coil Nails: {calculatedMaterials?.coilNails || 0} boxes</Text>
      </View>
    </Page>
  </Document>
);

export async function generatePDFBuffer(data: any, calculatedMaterials: any): Promise<Buffer> {
  const stream = await renderToStream(<JobPDFDocument data={data} calculatedMaterials={calculatedMaterials} />);
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('error', (err) => reject(err));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}
