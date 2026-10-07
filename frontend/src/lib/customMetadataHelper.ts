import { CertificateMetadata } from '../types/certificate';

export interface ResolvedCertificateDisplayInfo {
  recipientName: string;
  certificateTitle: string;
  issueDateStr: string;
  formattedDate: string | null;
  description: string;
}

/**
 * Robustly extracts and normalizes display variables (recipient name, certificate title,
 * issuance date, and description) from custom template values and metadata fallbacks.
 */
export function resolveCustomCertificateInfo(
  metadata: Partial<CertificateMetadata>,
  valuesOverride?: Record<string, string>
): ResolvedCertificateDisplayInfo {
  const customValues: Record<string, string> =
    valuesOverride ||
    (metadata.custom?.values as Record<string, string>) ||
    (metadata.templateValues as Record<string, string>) ||
    {};

  const entries = Object.entries(customValues);

  // 1. Recipient Name Resolver
  let resolvedName = '';
  const nameKeys = [
    'recipientName',
    'recipient_name',
    'studentName',
    'student_name',
    'participantName',
    'participant_name',
    'candidateName',
    'candidate_name',
    'fullName',
    'full_name',
    'name',
    'recipient',
  ];
  for (const k of nameKeys) {
    if (customValues[k] && typeof customValues[k] === 'string' && customValues[k].trim()) {
      resolvedName = customValues[k].trim();
      break;
    }
  }

  if (!resolvedName) {
    const candidate = entries.find(
      ([k, v]) =>
        /(name|participant|student|candidate|recipient)/i.test(k) &&
        !/(issuer|director|signer|head|authority|title|course|cert|date)/i.test(k) &&
        typeof v === 'string' &&
        v.trim().length > 1
    );
    if (candidate) resolvedName = candidate[1].trim();
  }

  if (!resolvedName) {
    if (
      metadata.recipientName &&
      metadata.recipientName !== 'Alice Nakamoto' &&
      metadata.recipientName !== 'Recipient'
    ) {
      resolvedName = metadata.recipientName;
    } else {
      // Find the first value that looks like a person's name (capitalized text, not title/date)
      const likelyName = entries.find(
        ([_, v]) =>
          typeof v === 'string' &&
          v.trim().length >= 3 &&
          v.trim().length <= 40 &&
          !/^\d{4}/.test(v) &&
          !/(certificate|completion|participation|achievement|director|university|consortium|diploma|bachelor|master|held|from|dated|session)/i.test(
            v
          )
      );
      if (likelyName) {
        resolvedName = likelyName[1].trim();
      } else {
        resolvedName = metadata.recipientName || 'Recipient';
      }
    }
  }

  // 2. Certificate Title Resolver
  let resolvedTitle = '';
  const titleKeys = [
    'certificateTitle',
    'certificate_title',
    'courseTitle',
    'course_title',
    'title',
    'awardTitle',
    'degreeTitle',
    'programTitle',
    'certificateType',
    'certType',
    'course',
    'program',
  ];
  for (const k of titleKeys) {
    if (customValues[k] && typeof customValues[k] === 'string' && customValues[k].trim()) {
      resolvedTitle = customValues[k].trim();
      break;
    }
  }

  if (!resolvedTitle) {
    const candidate = entries.find(
      ([k, v]) =>
        /(title|course|degree|award|program|cert)/i.test(k) &&
        !/(signer|director|issuer|date|name)/i.test(k) &&
        typeof v === 'string' &&
        v.trim().length > 2
    );
    if (candidate) resolvedTitle = candidate[1].trim();
  }

  if (!resolvedTitle) {
    const certVal = entries.find(
      ([_, v]) =>
        typeof v === 'string' &&
        /(certificate|diploma|degree|participation|achievement|excellence|mastery|workshop)/i.test(v)
    );
    if (certVal) {
      resolvedTitle = certVal[1].trim();
    } else if (
      metadata.certificateTitle &&
      metadata.certificateTitle !== 'CERTIFICATE OF ACHIEVEMENT' &&
      metadata.certificateTitle !== 'Certificate'
    ) {
      resolvedTitle = metadata.certificateTitle;
    } else {
      resolvedTitle = metadata.certificateTitle || 'Certificate of Completion';
    }
  }

  // 3. Issue Date Resolver
  let resolvedDateStr = '';
  const dateKeys = [
    'issueDate',
    'issue_date',
    'date',
    'eventDate',
    'heldFrom',
    'held_from',
    'issuedOn',
    'dateOfIssuance',
    'dateOfIssue',
    'event_date',
  ];
  for (const k of dateKeys) {
    if (customValues[k] && typeof customValues[k] === 'string' && customValues[k].trim()) {
      resolvedDateStr = customValues[k].trim();
      break;
    }
  }

  if (!resolvedDateStr) {
    const candidate = entries.find(
      ([k, v]) =>
        /(date|held|issued|time)/i.test(k) &&
        typeof v === 'string' &&
        v.trim().length >= 4
    );
    if (candidate) resolvedDateStr = candidate[1].trim();
  }

  if (!resolvedDateStr) {
    // Look for ISO date YYYY-MM-DD in any field value
    const datePatternVal = entries.find(
      ([_, v]) =>
        typeof v === 'string' && /\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\b/.test(v)
    );
    if (datePatternVal) {
      const match = datePatternVal[1].match(/\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\b/);
      if (match) resolvedDateStr = match[0];
    }
  }

  if (!resolvedDateStr) {
    resolvedDateStr = metadata.issueDate || '';
  }

  // Parse date
  let formattedDate: string | null = null;
  if (resolvedDateStr) {
    const isoMatch = resolvedDateStr.match(/\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\b/);
    const dateToParse = isoMatch ? isoMatch[0] : resolvedDateStr;
    const parsed = new Date(dateToParse);
    if (!isNaN(parsed.getTime())) {
      formattedDate = parsed.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } else {
      formattedDate = resolvedDateStr;
    }
  }

  // 4. Description
  const description =
    customValues.description ||
    customValues.details ||
    customValues.body ||
    customValues.mainBody ||
    metadata.description ||
    'Verified via CertiChain custom template.';

  return {
    recipientName: resolvedName,
    certificateTitle: resolvedTitle,
    issueDateStr: resolvedDateStr,
    formattedDate,
    description,
  };
}
