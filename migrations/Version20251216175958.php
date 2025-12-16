<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20251216175958 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE feed_video DROP FOREIGN KEY FK_8948899029C1004E');
        $this->addSql('ALTER TABLE feed_video DROP FOREIGN KEY FK_8948899051A5BC03');
        $this->addSql('DROP TABLE feed_video');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE TABLE feed_video (feed_id INT NOT NULL, video_id INT NOT NULL, INDEX IDX_8948899051A5BC03 (feed_id), INDEX IDX_8948899029C1004E (video_id), PRIMARY KEY(feed_id, video_id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB COMMENT = \'\' ');
        $this->addSql('ALTER TABLE feed_video ADD CONSTRAINT FK_8948899029C1004E FOREIGN KEY (video_id) REFERENCES video (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE feed_video ADD CONSTRAINT FK_8948899051A5BC03 FOREIGN KEY (feed_id) REFERENCES feed (id) ON DELETE CASCADE');
    }
}
