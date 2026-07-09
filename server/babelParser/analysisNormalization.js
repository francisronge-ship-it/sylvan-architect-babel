export const createAnalysisNormalizationHelpers = ({
  normalizeNodeIdArray,
  normalizeOptionalStepText,
  normalizeOptionalStringArray,
  normalizeTransportJsonArray
}) => {
  const collectStructuredEntries = (value) => {
    const parsedValue = normalizeTransportJsonArray(value);
    if (Array.isArray(parsedValue)) return parsedValue;
    if (!parsedValue || typeof parsedValue !== 'object') return [];
    return Object.entries(parsedValue)
      .map(([key, payload]) => ({
        __entryKey: String(key || '').trim(),
        ...(payload && typeof payload === 'object' ? payload : { value: payload })
      }))
      .filter((item) => Object.keys(item).length > 0);
  };

  const normalizeSupportAnchors = (item, nodeIds, stepIds) => {
    if (!item || typeof item !== 'object') return {};
    const normalizedNodeIds = normalizeNodeIdArray(item.nodeIds, nodeIds);
    const normalizedStepIds = Array.isArray(item.stepIds)
      ? item.stepIds
          .map((stepId) => normalizeOptionalStepText(stepId))
          .filter((stepId) => stepId && (!stepIds || stepIds.has(stepId)))
      : undefined;
    return {
      ...(normalizedNodeIds && normalizedNodeIds.length > 0 ? { nodeIds: normalizedNodeIds } : {}),
      ...(normalizedStepIds && normalizedStepIds.length > 0 ? { stepIds: normalizedStepIds } : {})
    };
  };

  const normalizeOpenOntologyLabel = (value) => {
    const text = String(value || '').trim();
    if (!text) return '';
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const normalizeFactIdArray = (items, allowedIds) => {
    if (!Array.isArray(items)) return undefined;
    const values = items
      .map((item) => normalizeOptionalStepText(item))
      .filter((item) => item && (!allowedIds || allowedIds.has(item)));
    return values.length > 0 ? Array.from(new Set(values)) : undefined;
  };

  const normalizeCommitmentParticipant = (participant, nodeIds) => {
    if (!participant || typeof participant !== 'object') return null;
    const rawNodeId = String(participant.nodeId || '').trim();
    const normalized = {
      role: normalizeOptionalStepText(participant.role),
      nodeId: rawNodeId && nodeIds.has(rawNodeId) ? rawNodeId : undefined,
      label: normalizeOptionalStepText(participant.label),
      value: normalizeOptionalStepText(participant.value)
    };
    return Object.values(normalized).some(Boolean) ? normalized : null;
  };

  const normalizeCommitmentParticipantsForMerge = (participants = []) => (
    Array.from(
      (Array.isArray(participants) ? participants : [])
        .filter((participant) => participant && typeof participant === 'object')
        .reduce((acc, participant) => {
          const normalized = {
            ...(normalizeOptionalStepText(participant.role) ? { role: normalizeOptionalStepText(participant.role) } : {}),
            ...(normalizeOptionalStepText(participant.nodeId) ? { nodeId: normalizeOptionalStepText(participant.nodeId) } : {}),
            ...(normalizeOptionalStepText(participant.label) ? { label: normalizeOptionalStepText(participant.label) } : {}),
            ...(normalizeOptionalStepText(participant.value) ? { value: normalizeOptionalStepText(participant.value) } : {})
          };
          if (Object.keys(normalized).length === 0) return acc;
          const mergeKey = `${normalized.role || ''}|${normalized.nodeId || ''}|${normalized.value || ''}`;
          const existing = acc.get(mergeKey);
          acc.set(mergeKey, {
            ...(existing || {}),
            ...normalized,
            ...(existing?.label || !normalized.label ? {} : { label: normalized.label }),
            ...(existing?.value || !normalized.value ? {} : { value: normalized.value })
          });
          return acc;
        }, new Map()).values()
    ).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))
  );

  const deriveRoleNameFromNodeField = (field, entry) => {
    if (field === 'nodeId') return normalizeOptionalStepText(entry?.role);
    if (!/NodeId$/.test(field)) return undefined;
    return normalizeOptionalStepText(
      field.replace(/NodeId$/, '').replace(/([a-z])([A-Z])/g, '$1-$2')
    );
  };

  const deriveSupportFromNodeFields = (entry, nodeIds) => {
    if (!entry || typeof entry !== 'object') return {};
    const derivedNodeIds = [];
    const derivedParticipants = [];

    const pushNodeId = (nodeId) => {
      const normalizedNodeId = String(nodeId || '').trim();
      if (!normalizedNodeId || !nodeIds.has(normalizedNodeId)) return undefined;
      derivedNodeIds.push(normalizedNodeId);
      return normalizedNodeId;
    };

    Object.entries(entry).forEach(([field, rawValue]) => {
      if (Array.isArray(rawValue) && /NodeIds$/.test(field)) {
        (normalizeNodeIdArray(rawValue, nodeIds) || []).forEach((nodeId) => {
          derivedNodeIds.push(nodeId);
        });
        return;
      }

      if (typeof rawValue !== 'string' || !/NodeId$/.test(field)) return;
      const nodeId = pushNodeId(rawValue);
      if (!nodeId) return;
      if (
        (field === 'hostNodeId' || field === 'targetNodeId')
        && String(entry.landingNodeId || '').trim() === nodeId
      ) {
        return;
      }
      const role = deriveRoleNameFromNodeField(field, entry);
      if (role) derivedParticipants.push({ role, nodeId });
    });

    return {
      nodeIds: derivedNodeIds.length > 0 ? Array.from(new Set(derivedNodeIds)) : undefined,
      participants: derivedParticipants.length > 0
        ? normalizeCommitmentParticipantsForMerge(derivedParticipants)
        : undefined
    };
  };

  const normalizeOpenFactFieldValue = (field, value, nodeIds, stepIds) => {
    if (value === undefined || value === null) return undefined;
    if (field === 'participants' && Array.isArray(value)) {
      const participants = value
        .map((item) => normalizeCommitmentParticipant(item, nodeIds))
        .filter(Boolean);
      return participants.length > 0 ? participants : undefined;
    }
    if (field === 'nodeIds') return normalizeNodeIdArray(value, nodeIds);
    if (field === 'stepIds') return normalizeFactIdArray(value, stepIds);
    if (field === 'chainId' || field === 'frameworkLabel' || field === 'factId' || field === 'subtype') {
      return normalizeOptionalStepText(value);
    }
    if (field === 'family' || field === 'kind') return normalizeOpenOntologyLabel(value);
    if (typeof value === 'boolean' || typeof value === 'number') return value;
    if (Array.isArray(value)) {
      if (/NodeIds?$/.test(field) || field === 'order' || /Nodes$/.test(field)) {
        return normalizeNodeIdArray(value, nodeIds);
      }
      return normalizeOptionalStringArray(value);
    }
    if (typeof value === 'string') {
      if (/NodeId$/.test(field)) {
        const nodeId = String(value || '').trim();
        return nodeId && nodeIds.has(nodeId) ? nodeId : undefined;
      }
      if (/StepId$/.test(field)) {
        const stepId = normalizeOptionalStepText(value);
        return stepId && (!stepIds || stepIds.has(stepId)) ? stepId : undefined;
      }
      return normalizeOptionalStepText(value);
    }
    return undefined;
  };

  const normalizeCommitmentFactEntry = (entry, nodeIds, stepIds) => {
    if (!entry || typeof entry !== 'object') return null;
    const kind = normalizeOpenOntologyLabel(entry.kind || entry.family);
    if (!kind) return null;

    const normalized = {
      ...normalizeSupportAnchors(entry, nodeIds, stepIds),
      factId: normalizeOptionalStepText(entry.factId),
      kind,
      family: normalizeOpenOntologyLabel(entry.family) || kind,
      frameworkLabel: normalizeOptionalStepText(entry.frameworkLabel),
      chainId: normalizeOptionalStepText(entry.chainId),
      subtype: normalizeOptionalStepText(entry.subtype)
    };

    Object.entries(entry).forEach(([field, rawValue]) => {
      if (field === '__entryKey' || field in normalized) return;
      const normalizedValue = normalizeOpenFactFieldValue(field, rawValue, nodeIds, stepIds);
      if (normalizedValue !== undefined) normalized[field] = normalizedValue;
    });

    const derivedSupport = deriveSupportFromNodeFields(normalized, nodeIds);
    const normalizedParticipants = normalizeCommitmentParticipantsForMerge([
      ...(Array.isArray(normalized.participants) ? normalized.participants : []),
      ...(Array.isArray(derivedSupport.participants) ? derivedSupport.participants : [])
    ]);
    const participantNodeIds = normalizedParticipants
      .map((participant) => String(participant?.nodeId || '').trim())
      .filter(Boolean);
    const mergedNodeIds = Array.from(new Set([
      ...((Array.isArray(normalized.nodeIds) ? normalized.nodeIds : []).map((nodeId) => String(nodeId || '').trim()).filter(Boolean)),
      ...((Array.isArray(derivedSupport.nodeIds) ? derivedSupport.nodeIds : []).map((nodeId) => String(nodeId || '').trim()).filter(Boolean)),
      ...participantNodeIds
    ]));
    if (mergedNodeIds.length > 0) normalized.nodeIds = mergedNodeIds;
    if (normalizedParticipants.length > 0) normalized.participants = normalizedParticipants;

    return normalized;
  };

  const normalizeCommitmentFacts = (value, nodeIds, stepIds) => (
    collectStructuredEntries(value)
      .map((entry) => normalizeCommitmentFactEntry(entry, nodeIds, stepIds))
      .filter(Boolean)
  );

  const ensureStructuredEntryIds = (entries, idField, prefix) => {
    if (!Array.isArray(entries) || entries.length === 0) return [];
    const usedIds = new Set(
      entries
        .map((entry) => normalizeOptionalStepText(entry?.[idField]))
        .filter(Boolean)
    );
    let counter = 1;

    const nextId = () => {
      let candidate = `${prefix}_${counter}`;
      while (usedIds.has(candidate)) {
        counter += 1;
        candidate = `${prefix}_${counter}`;
      }
      usedIds.add(candidate);
      counter += 1;
      return candidate;
    };

    return entries.map((entry) => {
      if (!entry || typeof entry !== 'object') return entry;
      if (normalizeOptionalStepText(entry[idField])) return entry;
      return { ...entry, [idField]: nextId() };
    });
  };

  return {
    normalizeCommitmentFacts,
    ensureStructuredEntryIds
  };
};
