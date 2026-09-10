export type WebsiteType = 'JIRA' | 'GOOGLESHEET' | 'APREELTS' | 'ADP' | null;

export interface StatusMap {
    [statusId: string]: string;
}

export interface RenderOptions {
    isVisible: boolean;
}

export interface JiraIssueFields {
    summary: string;
    status?: { id: string };
    assignee?: { emailAddress: string };
    parent?: { key: string };
}

export interface JiraIssue {
    key: string;
    fields: JiraIssueFields;
    /**
     * Legacy/unused field, kept only to preserve the exact original runtime
     * behavior of buildIssuesSummary (see shared/utils.ts). Always undefined
     * in real Jira API responses — the real parent key lives at
     * `fields.parent.key`. Do not remove without re-checking that call site.
     */
    parentKey?: string;
}
