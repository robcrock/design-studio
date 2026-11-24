# Text files

The required Text files module is the fallback reader for knowledge files without another registered file type. It displays their source as read-only text. Binary files are excluded from the knowledge inventory.

Development reads current source through the file layer. Deployed builds load inventoried support files as raw text. Files are never executed by this reader. See the shared [file-type contract](../../context/file-types.md) and [source workflow](../../context/maintainers/source.md).

`references.ts` owns the shared Markdown source grammar for file moves and copied resource links. Its availability is independent of the optional Documents renderer, so system knowledge and retained Markdown keep source maintenance support.
