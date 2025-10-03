/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as linkifyjs from 'linkifyjs';
import turndownService from 'turndown';
import * as rust from '../codemodel/index.js';

/**
 * sorts client params in place so they're in the order, endpoint, [credential], other
 * 
 * @param params the client parameters to sort
 */
export function sortClientParameters(params: Array<rust.ClientParameter>): void {
  params.sort((a: rust.ClientParameter, b: rust.ClientParameter): number => {
    if (a.kind === 'clientEndpoint' || (a.kind === 'clientCredential' && b.kind !== 'clientEndpoint')) {
      // endpoint always comes first, followed by credential (if applicable)
      return -1;
    }
    return 0;
  });
}

// used by formatDocs
const tds = new turndownService({ codeBlockStyle: 'fenced', fence: '```' });

/**
 * applies certain formatting to a doc string.
 * if the doc string doesn't require formatting
 * the original doc string is returned.
 * 
 * @param docs the doc string to format
 * @returns the original or formatted doc string
 */
export function formatDocs(docs: string): string {
  // if the docs contain any HTML, convert it to markdown
  if (docs.match(/<[a-z]+[\s\S]+\/[a-z]+>/i)) {
    docs = tds.turndown(docs);
  }

  // enclose any hyperlinks in angle brackets
  const links = linkifyjs.find(docs, 'url');
  for (const link of links) {
    const enclosed = `<${link.href}>`;

    // don't enclose hyperlinks that are already enclosed or are markdown
    if (!docs.includes(enclosed) && !docs.includes(`(${link.href})`)) {
      docs = docs.replace(link.href, enclosed);
    }
  }

  return docs;
}
