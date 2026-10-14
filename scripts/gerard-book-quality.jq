(.title // "" | ascii_downcase) as $title
| (.copy.text // "" | ascii_downcase) as $text
| .editorialQuality = {
    kind: "book",
    officialCover: (if .media.official == true then .media.url else null end),
    verifiedDestination: ((.copy.text // "") | ([scan("https://www\\.amazon\\.fr/dp/[A-Za-z0-9]+")][0] // null)),
    status: (if (.media.official == true) and ((.media.url // "") | test("^https://"))
                  and (($title | length) > 3) and ($text | contains($title))
                  and ($text | test("https://www\\.amazon\\.fr/dp/[A-Za-z0-9]+"))
             then "complete" else "incomplete" end)
  }
| if .editorialQuality.status != "complete" then
    .status = "blocked"
    | .reason = "book-editorial-metadata-incomplete"
    | .action = "do-not-schedule"
    | .delivery = {status: "not-attempted", publishingEnabled: false}
  else . end
